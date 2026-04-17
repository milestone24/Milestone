import {
  ProcessSelect as DBProcessSelect,
  processStatuses,
} from "@server/db/schema";
import z from "zod";

export type ProcessSelect = Omit<DBProcessSelect, "key" | "payload"> &
  (
    | {
        key: "update-asset-values";
        payload: {
          accountId: string;
          assetId: string;
          startDate: Date;
        };
      }
    | {
        key: string;
        payload: Record<string, unknown>;
      }
  );

export type UpdateAssetValuesProcess = Omit<
  DBProcessSelect,
  "key" | "payload"
> & {
  key: "update-asset-values";
  payload: {
    accountId: string;
    assetId: string;
    startDate: Date;
  };
};

export type UpdateSecuritiesDailyHistoryCacheProcess = Omit<
  DBProcessSelect,
  "key" | "payload"
> & {
  key: "update-securities-daily-history-cache";
  payload: {
    date: Date;
  };
};

export type DocumentOcrProcess = Omit<DBProcessSelect, "key" | "payload"> & {
  key: "document-ocr";
  payload: {
    documentId: string;
    platformKey: string;
    accountId: string;
    /** Present when started via `POST /api/assets/:assetId/documents/:platformKey/extract`. */
    nominatedUserAssetId?: string;
  };
};

export type OtherProcess = Omit<DBProcessSelect, "key" | "payload"> & {
  key: string;
  payload: Record<string, unknown>;
};

export const isUpdateSecuritiesDailyHistoryCacheProcess = (
  process: ProcessSelect
): process is UpdateSecuritiesDailyHistoryCacheProcess =>
  process.key === "update-securities-daily-history-cache";

export const isUpdateAssetValuesProcess = (
  process: ProcessSelect
): process is UpdateAssetValuesProcess => process.key === "update-asset-values";

export const isOtherProcess = (
  process: ProcessSelect
): process is OtherProcess => process.key !== "update-asset-values";

const processBaseSchema = z.object({
  id: z.string(),
  status: z.enum(processStatuses),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  supersededBy: z.string().nullable(),
  results: z.record(z.unknown()).nullable(),
  references: z.array(z.object({ type: z.literal("table") })).nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const processSelectSchema = z.union([
  processBaseSchema.extend({
    key: z.literal("update-asset-values"),
    payload: z.object({
      accountId: z.string(),
      assetId: z.string(),
      startDate: z.coerce.date(),
    }),
  }),
  processBaseSchema.extend({
    key: z.string(),
    payload: z.record(z.unknown()),
  }),
]);

processSelectSchema._output satisfies ProcessSelect;
