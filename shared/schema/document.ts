import { z } from "zod";
import type {
  DocumentInsert as DBDocumentInsert,
  DocumentSelect as DBDocumentSelect,
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
