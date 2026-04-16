import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getUserAccountId } from "@server/auth";
import { db } from "@server/db";
import {
  emailIngestInboxes,
  type EmailIngestAllowedSenders,
  type EmailIngestInboxSelect,
} from "@server/db/schema";
import type {
  EmailIngestInboxCreateRequest,
  EmailIngestInboxResponse,
  EmailIngestInboxUpdateAllowedSendersRequest,
} from "@shared/schema/email-ingest";

/**
 * Control plane for document email ingest inboxes.
 *
 * **EC2:** `/opt/milestone/.env` is refreshed by `deploy.sh` from SSM (`appEnvParameters` in
 * `infrastructure/milestone-app-construct.ts`). Mail inbound strings are published by
 * `MilestoneEmailInboundStack` under `/milestone/email-inbound/rails/<mailSubdomain>/…` plus shared
 * `/milestone/email-inbound/local-part-prefix`, `sqs-wait-time-seconds`, and
 * `sqs-visibility-timeout-seconds` (see `infrastructure/ssm-email-inbound.ts`). The EC2
 * stack chooses the rail via CDK context `emailInboundMailSubdomain` (default `doc-inbound`).
 *
 * - `EMAIL_INBOUND_MAIL_FQDN` — SSM `…/rails/<rail>/mail-fqdn` (ingest address host for that instance).
 * - `EMAIL_INGEST_LOCAL_PART_PREFIX` — SSM `/milestone/email-inbound/local-part-prefix`; deploy also
 *   `write_default`s `ingest` when the parameter cannot be read; this module defaults to `ingest` if unset.
 *
 * **Local:** set the same variable names in `.local.env` (values do not need to come from SSM).
 *
 * **Tenant:** uses `getUserAccountId()` (request context); callers must run under authenticated
 * user middleware (`runWithContext`).
 */

const SHORT_CODE_BYTE_LENGTH = 8;
const MAX_SHORT_CODE_INSERT_ATTEMPTS = 8;

function getMailFqdn(): string | undefined {
  const fqdn = process.env.EMAIL_INBOUND_MAIL_FQDN?.trim();
  return fqdn ? fqdn : undefined;
}

function getLocalPartPrefix(): string {
  const raw = process.env.EMAIL_INGEST_LOCAL_PART_PREFIX?.trim();
  if (raw === undefined || raw === "") {
    return "ingest";
  }
  return raw;
}

export function buildIngestAddress(shortCode: string): string | null {
  const fqdn = getMailFqdn();
  if (!fqdn) {
    return null;
  }
  const prefix = getLocalPartPrefix();
  return `${prefix}+${shortCode}@${fqdn}`;
}

function toAllowedSenders(value: unknown): EmailIngestAllowedSenders {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function mapRow(row: EmailIngestInboxSelect): EmailIngestInboxResponse {
  return {
    id: row.id,
    shortCode: row.shortCode,
    platformKey: row.platformKey ?? null,
    allowedSenders: toAllowedSenders(row.allowedSenders),
    status: row.status,
    revokedAt: row.revokedAt ?? null,
    replacedByInboxId: row.replacedByInboxId ?? null,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? null,
    ingestAddress: buildIngestAddress(row.shortCode),
  };
}

function generateShortCode(): string {
  return randomBytes(SHORT_CODE_BYTE_LENGTH).toString("hex");
}

async function insertInboxWithUniqueShortCode(values: {
  shortCode: string;
  platformKey: string | null;
  allowedSenders: EmailIngestAllowedSenders;
}): Promise<EmailIngestInboxSelect> {
  const userAccountId = getUserAccountId();
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SHORT_CODE_INSERT_ATTEMPTS; attempt += 1) {
    const shortCode =
      attempt === 0 ? values.shortCode : generateShortCode();
    try {
      const [row] = await db
        .insert(emailIngestInboxes)
        .values({
          userAccountId,
          shortCode,
          platformKey: values.platformKey,
          allowedSenders: values.allowedSenders,
          status: "active",
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create email ingest inbox");
      }
      return row;
    } catch (err) {
      lastError = err;
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not allocate a unique short code");
}

export async function listEmailIngestInboxes(options: {
  includeRevoked: boolean;
}): Promise<EmailIngestInboxResponse[]> {
  const userAccountId = getUserAccountId();
  const rows = await db
    .select()
    .from(emailIngestInboxes)
    .where(
      options.includeRevoked
        ? eq(emailIngestInboxes.userAccountId, userAccountId)
        : and(
            eq(emailIngestInboxes.userAccountId, userAccountId),
            eq(emailIngestInboxes.status, "active"),
          ),
    )
    .orderBy(desc(emailIngestInboxes.createdAt));

  return rows.map(mapRow);
}

export async function getEmailIngestInbox(
  inboxId: string,
): Promise<EmailIngestInboxResponse | null> {
  const userAccountId = getUserAccountId();
  const row = await db.query.emailIngestInboxes.findFirst({
    where: and(
      eq(emailIngestInboxes.userAccountId, userAccountId),
      eq(emailIngestInboxes.id, inboxId),
    ),
  });
  return row ? mapRow(row) : null;
}

export async function createEmailIngestInbox(
  body: EmailIngestInboxCreateRequest,
): Promise<EmailIngestInboxResponse> {
  const allowedSenders: EmailIngestAllowedSenders = body.allowedSenders ?? [];
  const platformKey =
    body.platformKey === undefined || body.platformKey === null
      ? null
      : body.platformKey;

  const row = await insertInboxWithUniqueShortCode({
    shortCode: generateShortCode(),
    platformKey,
    allowedSenders,
  });
  return mapRow(row);
}

export async function updateEmailIngestInboxAllowedSenders(
  inboxId: string,
  body: EmailIngestInboxUpdateAllowedSendersRequest,
): Promise<EmailIngestInboxResponse> {
  const userAccountId = getUserAccountId();
  const existing = await db.query.emailIngestInboxes.findFirst({
    where: and(
      eq(emailIngestInboxes.userAccountId, userAccountId),
      eq(emailIngestInboxes.id, inboxId),
    ),
  });

  if (!existing) {
    throw Object.assign(new Error("Inbox not found"), { status: 404 });
  }
  if (existing.status !== "active") {
    throw Object.assign(new Error("Inbox is not active"), { status: 409 });
  }

  const [updated] = await db
    .update(emailIngestInboxes)
    .set({
      allowedSenders: body.allowedSenders,
      updatedAt: new Date(),
    })
    .where(eq(emailIngestInboxes.id, inboxId))
    .returning();

  if (!updated) {
    throw Object.assign(new Error("Inbox not found"), { status: 404 });
  }
  return mapRow(updated);
}

export async function revokeEmailIngestInbox(
  inboxId: string,
): Promise<EmailIngestInboxResponse> {
  const userAccountId = getUserAccountId();
  const existing = await db.query.emailIngestInboxes.findFirst({
    where: and(
      eq(emailIngestInboxes.userAccountId, userAccountId),
      eq(emailIngestInboxes.id, inboxId),
    ),
  });

  if (!existing) {
    throw Object.assign(new Error("Inbox not found"), { status: 404 });
  }
  if (existing.status !== "active") {
    throw Object.assign(new Error("Inbox is already revoked"), { status: 409 });
  }

  const [updated] = await db
    .update(emailIngestInboxes)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailIngestInboxes.id, inboxId))
    .returning();

  if (!updated) {
    throw Object.assign(new Error("Inbox not found"), { status: 404 });
  }
  return mapRow(updated);
}

export async function regenerateEmailIngestInbox(
  inboxId: string,
): Promise<EmailIngestInboxResponse> {
  const userAccountId = getUserAccountId();
  return await db.transaction(async (tx) => {
    const existing = await tx.query.emailIngestInboxes.findFirst({
      where: and(
        eq(emailIngestInboxes.userAccountId, userAccountId),
        eq(emailIngestInboxes.id, inboxId),
      ),
    });

    if (!existing) {
      throw Object.assign(new Error("Inbox not found"), { status: 404 });
    }
    if (existing.status !== "active") {
      throw Object.assign(new Error("Inbox is not active"), { status: 409 });
    }

    const allowedSenders = toAllowedSenders(existing.allowedSenders);
    const platformKey = existing.platformKey ?? null;

    let newRow: EmailIngestInboxSelect | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SHORT_CODE_INSERT_ATTEMPTS; attempt += 1) {
      const shortCode = generateShortCode();
      try {
        const inserted = await tx
          .insert(emailIngestInboxes)
          .values({
            userAccountId,
            shortCode,
            platformKey,
            allowedSenders,
            status: "active",
          })
          .returning();
        newRow = inserted[0];
        break;
      } catch (err) {
        lastError = err;
        const code = (err as { code?: string }).code;
        if (code === "23505") {
          continue;
        }
        throw err;
      }
    }

    if (!newRow) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Could not allocate a unique short code");
    }

    const [revoked] = await tx
      .update(emailIngestInboxes)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        replacedByInboxId: newRow.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailIngestInboxes.id, inboxId),
          eq(emailIngestInboxes.status, "active"),
        ),
      )
      .returning();

    if (!revoked) {
      throw Object.assign(new Error("Inbox could not be revoked"), {
        status: 409,
      });
    }

    return mapRow(newRow);
  });
}
