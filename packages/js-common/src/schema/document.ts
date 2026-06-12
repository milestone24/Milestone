import { z } from "zod";
import {
  statementPlatformBrandDbMatchSchema,
  statementPlatformBrandIdentificationSchema,
} from "./platform-brand-ocr";
import {
  ocrAssetCandidateResultListSchema,
  securityTransactionOcrExtractionListSchema,
} from "./ocr";
import type {
  DocumentInsert as DBDocumentInsert,
  DocumentSelect as DBDocumentSelect,
  AssetTransactionDocumentInsert as DBAssetTransactionDocumentInsert,
  AssetTransactionDocumentSelect as DBAssetTransactionDocumentSelect,
  SecurityTransactionDocumentInsert as DBSecurityTransactionDocumentInsert,
  SecurityTransactionDocumentSelect as DBSecurityTransactionDocumentSelect,
} from "@milestone/data/schema";

export type Document = DBDocumentSelect;

export const documentSelectSchema = z.object({
  id: z.string().uuid(),
  userAccountId: z.string().uuid(),
  assetId: z.string().uuid().nullable(),
  fileName: z.string(),
  fileUrl: z.string(),
  mimeType: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

documentSelectSchema._output satisfies Document;

export const documentInsertSchema = z.object({
  userAccountId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().min(1, "File URL is required"),
  mimeType: z.string().min(1, "MIME type is required"),
});

documentInsertSchema._output satisfies DBDocumentInsert;

export type DocumentInsert = z.infer<typeof documentInsertSchema>;

const transactionDocumentBaseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const transactionDocumentBaseInsertSchema = z.object({
  documentId: z.string().uuid(),
});

export const assetTransactionDocumentSelectSchema =
  transactionDocumentBaseSchema.extend({
    assetTransactionId: z.string().uuid(),
  });

assetTransactionDocumentSelectSchema._output satisfies DBAssetTransactionDocumentSelect;

export const assetTransactionDocumentInsertSchema =
  transactionDocumentBaseInsertSchema.extend({
    assetTransactionId: z.string().uuid(),
  });

assetTransactionDocumentInsertSchema._output satisfies DBAssetTransactionDocumentInsert;

export type AssetTransactionDocumentInsert = z.infer<
  typeof assetTransactionDocumentInsertSchema
>;

export const securityTransactionDocumentSelectSchema =
  transactionDocumentBaseSchema.extend({
    securityTransactionId: z.string().uuid(),
  });

securityTransactionDocumentSelectSchema._output satisfies DBSecurityTransactionDocumentSelect;

export const securityTransactionDocumentInsertSchema =
  transactionDocumentBaseInsertSchema.extend({
    securityTransactionId: z.string().uuid(),
  });

securityTransactionDocumentInsertSchema._output satisfies DBSecurityTransactionDocumentInsert;

export type SecurityTransactionDocumentInsert = z.infer<
  typeof securityTransactionDocumentInsertSchema
>;

export const extractedAmountSchema = z.object({
  platformName: z.string(),
  amount: z.number(),
  confidence: z.number().min(0).max(1),
  accountType: z.string().optional(),
});

export type ExtractedAmount = z.infer<typeof extractedAmountSchema>;

export const documentOcrResponseSchema = z.object({
  jobId: z.string().uuid(),
  documentId: z.string().uuid(),
  ocrJobId: z.string().uuid(),
});

export type DocumentOcrResponse = z.infer<typeof documentOcrResponseSchema>;

export const ocrJobReviewStateSchema = z.enum([
  "pending_review",
  "accepted",
  "rejected",
]);

export type OcrJobReviewState = z.infer<typeof ocrJobReviewStateSchema>;

export const documentOcrJobSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "running", "completed", "failed", "aborted"]),
  platformKey: z.string(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
  /** Present when job completed; older rows may omit the key. */
  reviewState: ocrJobReviewStateSchema.nullable().optional(),
});

export type DocumentOcrJobSummary = z.infer<typeof documentOcrJobSummarySchema>;

export const documentWithOcrSchema = documentSelectSchema.extend({
  /** All OCR runs linked to this document (newest first). */
  ocrJobs: z.array(documentOcrJobSummarySchema),
});

export type DocumentWithOcr = z.infer<typeof documentWithOcrSchema>;

export const linkedProcessSummarySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "aborted"]),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
});

export type LinkedProcessSummary = z.infer<typeof linkedProcessSummarySchema>;

export const ocrJobListItemSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  documentFileName: z.string().nullable(),
  processId: z.string().uuid().nullable(),
  platformKey: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "aborted"]),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
  reviewState: ocrJobReviewStateSchema.nullable(),
  process: linkedProcessSummarySchema.nullable(),
});

export type OcrJobListItem = z.infer<typeof ocrJobListItemSchema>;

/** Result of multi-phase transaction OCR (brand → securities verifiers) for WebSocket / queue payloads. */
export const documentOcrPipelineResultSchema = z.object({
  brandIdentification: statementPlatformBrandIdentificationSchema,
  brandDbMatch: statementPlatformBrandDbMatchSchema,
  securityHoldings: securityTransactionOcrExtractionListSchema,
  /** Asset-first resolution tree; always an array (empty when no portfolio rows match the account). */
  assetCandidates: ocrAssetCandidateResultListSchema.default([]),
  /**
   * When brand verification found a platform, true if this account has at least one
   * `user_assets` row with that `platform_id` (broader than 4c candidates, which need holdings).
   */
  hasPortfolioAccountOnMatchedPlatform: z.boolean().default(false),
  /**
   * Upload / ingest context: `user_assets.id` for asset-scoped extract, email ingest nominee, etc.
   * Does not assert the statement belongs to that account; see `assetCandidates` for scoring.
   */
  nominatedUserAssetId: z.string().uuid().nullable().default(null),
  llmPath: z.enum(["text", "vision"]),
  nativePdfCharCount: z.number().int().nonnegative().optional(),
});

export type DocumentOcrPipelineResult = z.infer<typeof documentOcrPipelineResultSchema>;

export const ocrJobDetailSchema = ocrJobListItemSchema.extend({
  extractedValues: z.array(extractedAmountSchema).nullable(),
  pipeline: documentOcrPipelineResultSchema.nullable(),
});

export type OcrJobDetail = z.infer<typeof ocrJobDetailSchema>;

export const ocrJobReviewRequestSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("rejected") }),
  z.object({
    outcome: z.literal("accepted"),
    securityTransactionIds: z.array(z.string().uuid()),
  }),
]);

export type OcrJobReviewRequest = z.infer<typeof ocrJobReviewRequestSchema>;

export const assetOcrPendingReviewItemSchema = z.object({
  ocrJobId: z.string().uuid(),
  processId: z.string().uuid().nullable(),
  documentId: z.string().uuid().nullable(),
  fileName: z.string().nullable(),
  completedAt: z.coerce.date().nullable(),
  extractedValues: z.array(extractedAmountSchema).nullable(),
  pipeline: documentOcrPipelineResultSchema.nullable(),
});

export type AssetOcrPendingReviewItem = z.infer<
  typeof assetOcrPendingReviewItemSchema
>;
