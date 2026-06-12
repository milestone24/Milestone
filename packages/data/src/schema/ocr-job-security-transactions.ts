import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { InferInsertModelBasic } from "./utils.js";
import { ocrJobs } from "./ocr-jobs.js";
import { securityTransactions } from "./portfolio-assets.js";

/**
 * Links OCR jobs to security transactions created when the user accepts review
 * (one row per transaction).
 */
export const ocrJobSecurityTransactions = pgTable(
  "ocr_job_security_transactions",
  {
    ocrJobId: uuid("ocr_job_id")
      .notNull()
      .references(() => ocrJobs.id, { onDelete: "cascade" }),
    securityTransactionId: uuid("security_transaction_id")
      .notNull()
      .references(() => securityTransactions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.ocrJobId, table.securityTransactionId] }),
    index("ocr_job_security_transactions_ocr_job_id_idx").on(table.ocrJobId),
  ]
);

export type OcrJobSecurityTransactionSelect = InferSelectModel<
  typeof ocrJobSecurityTransactions
>;
export type OcrJobSecurityTransactionInsert = InferInsertModelBasic<
  typeof ocrJobSecurityTransactions
>;
