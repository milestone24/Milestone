import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import type { AddressObject, Attachment, ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import { runWithContext } from "@server/context/request-context";
import { db } from "@server/db";
import {
  emailIngestEvents,
  emailIngestInboxes,
  type EmailIngestAllowedSenders,
} from "@server/db/schema";
import { error as logError, info } from "@server/log";
import { startDocumentOcr } from "@server/services/process/document-ocr";
import { pickShortCodeFromRecipients } from "./inbound-mail-routing";

type IngestPayload =
  | { kind: "pdf"; buffer: Buffer; originalname: string }
  | { kind: "html"; buffer: Buffer }
  | { kind: "plain"; buffer: Buffer };

const PDF_MIME = "application/pdf";

function readMessageId(mail: ParsedMail): string | null {
  if (typeof mail.messageId === "string" && mail.messageId.trim()) {
    return mail.messageId.trim();
  }
  return null;
}

function toAllowedSenders(value: unknown): EmailIngestAllowedSenders {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function senderIsAllowed(
  allowedSenders: EmailIngestAllowedSenders,
  fromAddress: string,
): boolean {
  if (allowedSenders.length === 0) {
    return true;
  }
  const from = fromAddress.trim().toLowerCase();
  for (const rule of allowedSenders) {
    const r = rule.trim().toLowerCase();
    if (!r) {
      continue;
    }
    if (r.startsWith("@")) {
      if (from.endsWith(r)) {
        return true;
      }
    } else if (from === r) {
      return true;
    }
  }
  return false;
}

function normalizeAddressObjects(
  value: AddressObject | AddressObject[] | undefined,
): AddressObject[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function collectRecipientAddresses(mail: ParsedMail): string[] {
  const out: string[] = [];
  const addObj = (obj: AddressObject | undefined) => {
    if (!obj?.value) {
      return;
    }
    for (const v of obj.value) {
      if (v.address) {
        out.push(v.address);
      }
    }
  };
  for (const obj of normalizeAddressObjects(mail.to)) {
    addObj(obj);
  }
  for (const obj of normalizeAddressObjects(mail.cc)) {
    addObj(obj);
  }
  for (const obj of normalizeAddressObjects(mail.bcc)) {
    addObj(obj);
  }
  return out;
}

function resolveFromAddress(mail: ParsedMail): string | null {
  const from = mail.from?.value?.[0]?.address;
  return from ? from.trim().toLowerCase() : null;
}

function formatAttachmentForLog(att: Attachment, index: number): string {
  const mime = (att.contentType || "").toLowerCase().split(";")[0]?.trim() ?? "";
  const name = att.filename ?? "";
  const contentDesc =
    att.content == null
      ? "null"
      : Buffer.isBuffer(att.content)
        ? `buffer(len=${att.content.length})`
        : typeof att.content;
  return `[${index}] type=${mime} filename=${JSON.stringify(name)} content=${contentDesc}`;
}

function summarizeAttachmentsForLog(attachments: Attachment[]): string {
  if (attachments.length === 0) {
    return "attachments=0";
  }
  const max = 10;
  const slice = attachments.slice(0, max);
  const formatted = slice.map((att, i) => formatAttachmentForLog(att, i));
  const extra =
    attachments.length > max ? ` (+${attachments.length - max} more)` : "";
  return `attachments=${attachments.length} ${formatted.join(" ")}${extra}`;
}

function mailBodyDiagnostics(parsed: ParsedMail): string {
  const htmlLen =
    typeof parsed.html === "string" ? parsed.html.trim().length : 0;
  const textAsHtmlLen =
    typeof parsed.textAsHtml === "string"
      ? parsed.textAsHtml.trim().length
      : 0;
  const textLen =
    typeof parsed.text === "string" ? parsed.text.trim().length : 0;
  return `htmlChars=${String(htmlLen)} textAsHtmlChars=${String(textAsHtmlLen)} textChars=${String(textLen)}`;
}

function resolveIngestPayload(
  attachmentList: Attachment[],
  parsed: ParsedMail,
): IngestPayload | null {
  const pdf = pickFirstPdfAttachment(attachmentList);
  if (pdf?.content && Buffer.isBuffer(pdf.content)) {
    const originalname =
      pdf.filename && pdf.filename.trim().length > 0
        ? pdf.filename.trim()
        : "statement.pdf";
    return { kind: "pdf", buffer: pdf.content, originalname };
  }
  if (typeof parsed.html === "string" && parsed.html.trim().length > 0) {
    return { kind: "html", buffer: Buffer.from(parsed.html, "utf8") };
  }
  if (
    typeof parsed.textAsHtml === "string" &&
    parsed.textAsHtml.trim().length > 0
  ) {
    return { kind: "html", buffer: Buffer.from(parsed.textAsHtml, "utf8") };
  }
  if (typeof parsed.text === "string" && parsed.text.trim().length > 0) {
    return { kind: "plain", buffer: Buffer.from(parsed.text, "utf8") };
  }
  return null;
}

function pickFirstPdfAttachment(
  attachments: Attachment[],
): Attachment | null {
  for (const att of attachments) {
    const mime = (att.contentType || "").toLowerCase().split(";")[0]?.trim();
    const name = (att.filename || "").toLowerCase();
    if (mime === PDF_MIME || name.endsWith(".pdf")) {
      return att;
    }
  }
  return null;
}

function ingestPayloadToMulterFile(ingest: IngestPayload): Express.Multer.File {
  if (ingest.kind === "pdf") {
    return toMulterFile({
      buffer: ingest.buffer,
      originalname: ingest.originalname,
      mimetype: PDF_MIME,
    });
  }
  if (ingest.kind === "html") {
    return toMulterFile({
      buffer: ingest.buffer,
      originalname: "email-body.html",
      mimetype: "text/html",
    });
  }
  return toMulterFile({
    buffer: ingest.buffer,
    originalname: "email-body.txt",
    mimetype: "text/plain",
  });
}

function toMulterFile(params: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: params.originalname,
    encoding: "7bit",
    mimetype: params.mimetype,
    buffer: params.buffer,
    size: params.buffer.length,
    destination: "",
    filename: "",
    path: "",
    stream: Readable.from(params.buffer),
  } as Express.Multer.File;
}

async function updateEvent(
  eventId: string,
  patch: Partial<{
    status: "pending" | "processing" | "completed" | "failed";
    error: string | null;
    emailIngestInboxId: string | null;
    documentId: string | null;
    processId: string | null;
    rfc5322MessageId: string | null;
  }>,
): Promise<void> {
  await db
    .update(emailIngestEvents)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(emailIngestEvents.id, eventId));
}

export async function processInboundS3MailObject(params: {
  bucketName: string;
  objectKey: string;
}): Promise<void> {
  const { bucketName, objectKey } = params;

  const s3 = new S3Client({
    region: process.env.AWS_REGION ?? "eu-west-2",
  });

  const get = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  const body = get.Body;
  if (!body) {
    throw new Error("Inbound S3 object has empty body");
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks);
  const contentSha256 = createHash("sha256").update(raw).digest("hex");

  const parsed = await simpleParser(raw);
  info(
    `[email-ingest] parsed MIME bucket=${bucketName} key=${objectKey} bytes=${raw.length} sha256=${contentSha256}`,
  );

  const fromAddress = resolveFromAddress(parsed);
  if (!fromAddress) {
    await recordFailedIngestWithoutClaim({
      bucketName,
      objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      error: "Missing From address",
    });
    return;
  }

  const recipients = collectRecipientAddresses(parsed);
  const shortCode = pickShortCodeFromRecipients(recipients);
  if (!shortCode) {
    await recordFailedIngestWithoutClaim({
      bucketName,
      objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      error: "No matching ingest recipient address",
      decisionContext: `from=${fromAddress} recipients=${recipients.join(",")}`,
    });
    return;
  }

  const inbox = await db.query.emailIngestInboxes.findFirst({
    where: and(
      eq(emailIngestInboxes.shortCode, shortCode),
      eq(emailIngestInboxes.status, "active"),
    ),
  });

  if (!inbox) {
    await recordFailedIngestWithoutClaim({
      bucketName,
      objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      error: "Inbox not found or revoked",
      decisionContext: `shortCode=${shortCode} from=${fromAddress}`,
    });
    return;
  }

  const allowedSenders = toAllowedSenders(inbox.allowedSenders);
  if (!senderIsAllowed(allowedSenders, fromAddress)) {
    await recordFailedIngestWithoutClaim({
      bucketName,
      objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      emailIngestInboxId: inbox.id,
      error: "Sender not on allow list",
      decisionContext: `from=${fromAddress} shortCode=${shortCode} allowListSize=${allowedSenders.length}`,
    });
    return;
  }

  const attachmentList = parsed.attachments || [];
  const ingest = resolveIngestPayload(attachmentList, parsed);
  if (ingest === null) {
    const summary = summarizeAttachmentsForLog(attachmentList);
    const bodies = mailBodyDiagnostics(parsed);
    info(
      `[email-ingest] ingest source: none (${summary}; ${bodies}) bucket=${bucketName} key=${objectKey} inboxId=${inbox.id}`,
    );
    await recordFailedIngestWithoutClaim({
      bucketName,
      objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      emailIngestInboxId: inbox.id,
      error: "No PDF attachment or email body content",
      decisionContext: `${summary} ${bodies}`,
    });
    return;
  }

  if (ingest.kind === "pdf") {
    info(
      `[email-ingest] ingest source: PDF attachment filename=${JSON.stringify(ingest.originalname)} bytes=${ingest.buffer.length} bucket=${bucketName} key=${objectKey} inboxId=${inbox.id}`,
    );
  } else if (ingest.kind === "html") {
    info(
      `[email-ingest] ingest source: email HTML body bytes=${ingest.buffer.length} bucket=${bucketName} key=${objectKey} inboxId=${inbox.id}`,
    );
  } else {
    info(
      `[email-ingest] ingest source: email plain text body bytes=${ingest.buffer.length} bucket=${bucketName} key=${objectKey} inboxId=${inbox.id}`,
    );
  }

  const inserted = await db
    .insert(emailIngestEvents)
    .values({
      s3Bucket: bucketName,
      s3Key: objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      status: "processing",
      emailIngestInboxId: inbox.id,
    })
    .onConflictDoNothing({
      target: [emailIngestEvents.s3Bucket, emailIngestEvents.s3Key],
    })
    .returning({ id: emailIngestEvents.id });

  const row = inserted[0];
  if (!row) {
    const existing = await db.query.emailIngestEvents.findFirst({
      where: and(
        eq(emailIngestEvents.s3Bucket, bucketName),
        eq(emailIngestEvents.s3Key, objectKey),
      ),
    });
    if (existing?.status === "completed") {
      info(
        `[email-ingest] skip duplicate object (already completed) bucket=${bucketName} key=${objectKey} eventId=${existing.id}`,
      );
      return;
    }
    info(
      `[email-ingest] skip duplicate object (no new processing row) bucket=${bucketName} key=${objectKey} existingStatus=${existing?.status ?? "none"}`,
    );
    return;
  }

  const eventId = row.id;
  info(
    `[email-ingest] claimed ingest event eventId=${eventId} status=processing inboxId=${inbox.id} bucket=${bucketName} key=${objectKey}`,
  );

  try {
    const platformKey = inbox.platformKey?.trim() || "unknown";
    const file = ingestPayloadToMulterFile(ingest);

    const result = await runWithContext(
      { userAccountId: inbox.userAccountId },
      async () =>
        startDocumentOcr(file, platformKey, [], {
          nominatedUserAssetId: inbox.nominatedUserAssetId ?? undefined,
        }),
    );

    await updateEvent(eventId, {
      status: "completed",
      documentId: result.documentId,
      processId: result.jobId,
      error: null,
    });
    info(
      `[email-ingest] ingest completed eventId=${eventId} documentId=${result.documentId} processId=${result.jobId} bucket=${bucketName} key=${objectKey}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateEvent(eventId, {
      status: "failed",
      error: message,
    });
    logError(
      `[email-ingest] ingest failed after document accepted eventId=${eventId} bucket=${bucketName} key=${objectKey} err=${message}`,
    );
  }
}

async function recordFailedIngestWithoutClaim(params: {
  bucketName: string;
  objectKey: string;
  contentSha256: string;
  rfc5322MessageId: string | null;
  emailIngestInboxId?: string | null;
  error: string;
  decisionContext?: string;
}): Promise<void> {
  const ctx =
    params.decisionContext !== undefined && params.decisionContext.length > 0
      ? ` context=${params.decisionContext}`
      : "";
  info(
    `[email-ingest] ingest declined: ${params.error}${ctx} bucket=${params.bucketName} key=${params.objectKey} rfc5322MessageId=${params.rfc5322MessageId ?? "none"}`,
  );
  await db
    .insert(emailIngestEvents)
    .values({
      s3Bucket: params.bucketName,
      s3Key: params.objectKey,
      contentSha256: params.contentSha256,
      rfc5322MessageId: params.rfc5322MessageId,
      status: "failed",
      error: params.error,
      emailIngestInboxId: params.emailIngestInboxId ?? null,
    })
    .onConflictDoNothing({
      target: [emailIngestEvents.s3Bucket, emailIngestEvents.s3Key],
    });
}
