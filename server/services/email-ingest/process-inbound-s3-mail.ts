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
import { startDocumentOcr } from "@server/services/process/document-ocr";
import { pickShortCodeFromRecipients } from "./inbound-mail-routing";

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
    });
    return;
  }

  const pdf = pickFirstPdfAttachment(parsed.attachments || []);
  if (!pdf?.content || !Buffer.isBuffer(pdf.content)) {
    await recordFailedIngestWithoutClaim({
      bucketName,
      objectKey,
      contentSha256,
      rfc5322MessageId: readMessageId(parsed),
      emailIngestInboxId: inbox.id,
      error: "No PDF attachment found",
    });
    return;
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
      return;
    }
    return;
  }

  const eventId = row.id;

  try {
    const platformKey = inbox.platformKey?.trim() || "unknown";
    const originalName =
      pdf.filename && pdf.filename.trim().length > 0
        ? pdf.filename.trim()
        : "statement.pdf";
    const file = toMulterFile({
      buffer: pdf.content,
      originalname: originalName,
      mimetype: PDF_MIME,
    });

    const result = await runWithContext(
      { userAccountId: inbox.userAccountId },
      async () => startDocumentOcr(file, platformKey, []),
    );

    await updateEvent(eventId, {
      status: "completed",
      documentId: result.documentId,
      processId: result.jobId,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateEvent(eventId, {
      status: "failed",
      error: message,
    });
  }
}

async function recordFailedIngestWithoutClaim(params: {
  bucketName: string;
  objectKey: string;
  contentSha256: string;
  rfc5322MessageId: string | null;
  emailIngestInboxId?: string | null;
  error: string;
}): Promise<void> {
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
