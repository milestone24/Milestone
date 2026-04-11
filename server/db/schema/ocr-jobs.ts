import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { InferSelectModel, sql } from "drizzle-orm";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { processStatus } from "./processes";
import { documents } from "./portfolio-assets";
import { processes } from "./processes";

/**
 * Local shape for the balance extraction results stored in extracted_values.
 * Mirrors ExtractedAmount in shared/schema/document.ts.
 */
type OcrJobExtractedValues = Array<{
  platformName: string;
  amount: number;
  confidence: number;
  accountType?: string;
}>;

/**
 * Local shape for the full multi-phase OCR pipeline result stored in pipeline.
 * Mirrors DocumentOcrPipelineResult in shared/schema/document.ts.
 * Typed loosely here to avoid a circular dependency with shared/schema.
 */
type OcrJobPipeline = {
  brandIdentification: Record<string, unknown>;
  brandDbMatch: Record<string, unknown>;
  securityHoldings: Array<Record<string, unknown>>;
  llmPath: "text" | "vision";
  nativePdfCharCount?: number;
};

export const ocrJobs = pgTable(
  "ocr_jobs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    processId: uuid("process_id").references(() => processes.id, {
      onDelete: "set null",
    }),
    platformKey: text("platform_key").notNull(),
    status: processStatus("status").notNull(),
    extractedValues: jsonb("extracted_values")
      .$type<OcrJobExtractedValues>(),
    pipeline: jsonb("pipeline").$type<OcrJobPipeline>(),
    error: text("error"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    ...timestampColumns(),
  },
  (table) => [
    index("ocr_jobs_document_id_idx").on(table.documentId),
    index("ocr_jobs_process_id_idx").on(table.processId),
    check(
      "ocr_jobs_status_completed_or_failed_or_aborted_has_completed_at",
      sql`(${table.status} in ('completed', 'failed', 'aborted') and ${table.completedAt} is not null) or (${table.status} not in ('completed', 'failed', 'aborted') and ${table.completedAt} is null)`
    ),
  ]
);

export type OcrJobSelect = InferSelectModel<typeof ocrJobs>;
export type OcrJobInsert = InferInsertModelBasic<typeof ocrJobs>;
