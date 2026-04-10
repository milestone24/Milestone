import { z } from "zod";
import {
  statementPlatformBrandDbMatchSchema,
  statementPlatformBrandIdentificationSchema,
} from "./platform-brand-ocr";
import { securityTransactionOcrExtractionListSchema } from "./transaction";
import type {
  DocumentInsert as DBDocumentInsert,
  DocumentSelect as DBDocumentSelect,
  AssetTransactionDocumentInsert as DBAssetTransactionDocumentInsert,
  AssetTransactionDocumentSelect as DBAssetTransactionDocumentSelect,
  SecurityTransactionDocumentInsert as DBSecurityTransactionDocumentInsert,
  SecurityTransactionDocumentSelect as DBSecurityTransactionDocumentSelect,
} from "@server/db/schema";

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
});

export type DocumentOcrResponse = z.infer<typeof documentOcrResponseSchema>;

/** Result of multi-phase transaction OCR (brand → securities verifiers) for WebSocket / queue payloads. */
export const documentOcrPipelineResultSchema = z.object({
  brandIdentification: statementPlatformBrandIdentificationSchema,
  brandDbMatch: statementPlatformBrandDbMatchSchema,
  securityHoldings: securityTransactionOcrExtractionListSchema,
  llmPath: z.enum(["text", "vision"]),
  nativePdfCharCount: z.number().int().nonnegative().optional(),
});

export type DocumentOcrPipelineResult = z.infer<typeof documentOcrPipelineResultSchema>;
