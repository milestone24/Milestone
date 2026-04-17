import {
  AnyPgColumn,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql, InferSelectModel } from "drizzle-orm";
import { userAccounts } from "./user-account";
import { documents } from "./portfolio-assets";
import { processes } from "./processes";
import { InferInsertModelBasic, timestampColumns } from "./utils";

/**
 * Per-inbox allow list: JSON array of strings. Each entry is either a full
 * address (`broker@example.com`) or a domain suffix (`@broker.example.com`).
 */
export type EmailIngestAllowedSenders = string[];

export const emailIngestInboxStatuses = ["active", "revoked"] as const;
export const emailIngestInboxStatus = pgEnum(
  "email_ingest_inbox_status",
  emailIngestInboxStatuses,
);
export type EmailIngestInboxStatus =
  (typeof emailIngestInboxStatuses)[number];

export const emailIngestEventStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export const emailIngestEventStatus = pgEnum(
  "email_ingest_event_status",
  emailIngestEventStatuses,
);
export type EmailIngestEventStatus =
  (typeof emailIngestEventStatuses)[number];

export const emailIngestInboxes = pgTable(
  "email_ingest_inboxes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userAccountId: uuid("user_account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "cascade" }),
    shortCode: text("short_code").notNull(),
    platformKey: text("platform_key"),
    allowedSenders: jsonb("allowed_senders")
      .$type<EmailIngestAllowedSenders>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: emailIngestInboxStatus("status").notNull().default("active"),
    revokedAt: timestamp("revoked_at"),
    replacedByInboxId: uuid("replaced_by_inbox_id").references(
      (): AnyPgColumn => emailIngestInboxes.id,
      { onDelete: "set null" },
    ),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("email_ingest_inboxes_short_code_active_unique")
      .on(table.shortCode)
      .where(sql`${table.status} = 'active'`),
    index("email_ingest_inboxes_user_account_id_idx").on(table.userAccountId),
  ],
);

export type EmailIngestInboxSelect = InferSelectModel<typeof emailIngestInboxes>;
export type EmailIngestInboxInsert = InferInsertModelBasic<
  typeof emailIngestInboxes
>;

export const emailIngestEvents = pgTable(
  "email_ingest_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    s3Bucket: text("s3_bucket").notNull(),
    s3Key: text("s3_key").notNull(),
    contentSha256: text("content_sha256").notNull(),
    rfc5322MessageId: text("rfc5322_message_id"),
    status: emailIngestEventStatus("status").notNull().default("pending"),
    error: text("error"),
    emailIngestInboxId: uuid("email_ingest_inbox_id").references(
      () => emailIngestInboxes.id,
      { onDelete: "set null" },
    ),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    processId: uuid("process_id").references(() => processes.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  },
  (table) => [
    unique("email_ingest_events_s3_bucket_s3_key_unique").on(
      table.s3Bucket,
      table.s3Key,
    ),
    index("email_ingest_events_email_ingest_inbox_id_idx").on(
      table.emailIngestInboxId,
    ),
    index("email_ingest_events_document_id_idx").on(table.documentId),
    index("email_ingest_events_process_id_idx").on(table.processId),
    index("email_ingest_events_content_sha256_idx").on(table.contentSha256),
  ],
);

export type EmailIngestEventSelect = InferSelectModel<typeof emailIngestEvents>;
export type EmailIngestEventInsert = InferInsertModelBasic<
  typeof emailIngestEvents
>;

export const emailIngestInboxesRelations = relations(
  emailIngestInboxes,
  ({ one, many }) => ({
    userAccount: one(userAccounts, {
      fields: [emailIngestInboxes.userAccountId],
      references: [userAccounts.id],
    }),
    ingestEvents: many(emailIngestEvents),
  }),
);

export const emailIngestEventsRelations = relations(
  emailIngestEvents,
  ({ one }) => ({
    inbox: one(emailIngestInboxes, {
      fields: [emailIngestEvents.emailIngestInboxId],
      references: [emailIngestInboxes.id],
    }),
    document: one(documents, {
      fields: [emailIngestEvents.documentId],
      references: [documents.id],
    }),
    process: one(processes, {
      fields: [emailIngestEvents.processId],
      references: [processes.id],
    }),
  }),
);
