import { z, ZodType } from "zod";
import type {
  SecuritySelect as DBSecuritySelect,
  SecurityTransactionSelect as DBSecurityTransactionSelect,
  SecurityTransactionInsert as DBSecurityTransactionInsert,
} from "@server/db/schema/index";
import { BrandedValue, IfConstructorEquals, UserAssetSecuritySelect } from ".";

export type { SecurityDailyHistorySelect } from "@server/db/schema/index";

// Security Insert Schemas
export const securityInsertSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  name: z.string().min(1, "Name is required"),
  sourceIdentifier: z.string().min(1, "Source identifier is required"),
  exchange: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  type: z.string().optional(),
  isin: z.string().optional().nullable(),
  cusip: z.string().optional().nullable(),
  figi: z.string().optional().nullable(),
});

type ZodSecurityInsert = z.infer<typeof securityInsertSchema>;
export type SecurityInsert = ZodSecurityInsert;
export type SecuritySelect = DBSecuritySelect;
// export type SecurityInsert = IfConstructorEquals<ZodSecurityInsert, DBSecurityInsert, never>;
// securityInsertSchema satisfies ZodType<SecurityInsert>;

// Security Search Response Types
export const securitySearchResultSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  type: z.string().optional(),
  isin: z.string().optional(),
  cusip: z.string().optional(),
  figi: z.string().optional(),
  fromCache: z.boolean(),
  sourceIdentifier: z.string(),
});

export type SecuritySearchResult = z.infer<typeof securitySearchResultSchema>;

export type SecurityTransaction = DBSecurityTransactionSelect;

export const securityTransactionOrphanInsertSchema = z.object({
  value: z
    .number()
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val)),
  currencyValue: z.number(),
  fees: z.number().optional().nullable(),
  currency: z.string().optional(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date().optional(),
});

type ZodSecurityTransactionOrphanInsert = z.infer<
  typeof securityTransactionOrphanInsertSchema
>;

export type SecurityTransactionOrphanInsert = IfConstructorEquals<
  ZodSecurityTransactionOrphanInsert,
  Omit<DBSecurityTransactionInsert, "assetSecurityId" | "recordedAt">,
  never
>;

securityTransactionOrphanInsertSchema satisfies ZodType<SecurityTransactionOrphanInsert>;

export type SecurityTransactionSelect = DBSecurityTransactionSelect;

export const securityTransactionInsertSchema =
  securityTransactionOrphanInsertSchema.extend({
    assetSecurityId: z.string(),
  });

type ZodSecurityTransactionInsert = z.infer<
  typeof securityTransactionInsertSchema
>;

export type SecurityTransactionInsert = IfConstructorEquals<
  ZodSecurityTransactionInsert,
  Omit<DBSecurityTransactionInsert, "recordedAt">,
  never
>;

export type SecurityTransactionUpsert = SecurityTransactionInsert & {
  id?: string;
};

export type UserAssetSecurityTransactionResolved = {
  id: string;
  assetSecurityId: string;
  securityName: string;
  value: number;
  currency: string;
  currencyValue: number;
  valueDate: Date;
  recordedAt: Date;
};

export type BrandedUserAssetSecurityTransactionResolved = BrandedValue<
  UserAssetSecurityTransactionResolved,
  "transaction"
>;

// // Cache Management Types
// export const securityCacheRequestSchema = z.object({
//   securities: z.array(securityOrphanInsertSchema),
// });

// export type SecurityCacheRequest = z.infer<typeof securityCacheRequestSchema>;

// export const securityCacheResponseSchema = z.object({
//   message: z.string(),
//   securities: z.array(securitySearchResultSchema),
// });

// export type SecurityCacheResponse = z.infer<typeof securityCacheResponseSchema>;
