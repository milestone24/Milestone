import { z, ZodType } from "zod";
import type {
  SecuritySelect as DBSecuritySelect,
  SecurityInsert as DBSecurityInsert,
  SecurityTransactionSelect as DBSecurityTransactionSelect,
  SecurityTransactionInsert as DBSecurityTransactionInsert,
} from "@server/db/schema/index";
import { IfConstructorEquals, UserAssetSecuritySelect } from ".";
import { BrandedValue } from "./common";
import { NullableKeysToOptional } from "./utils";

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

export type SecurityInsert = z.infer<typeof securityInsertSchema>;

securityInsertSchema._input satisfies DBSecurityInsert;

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

export const securitySelectSchema = z.object({
  id: z.string(),
  sourceIdentifier: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  symbol: z.string(),
  name: z.string(),
  exchange: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  type: z.string().optional(),
  isin: z.string().optional(),
  cusip: z.string().optional(),
  figi: z.string().optional(),
});

export type SecuritySelect = z.infer<typeof securitySelectSchema>;

// Documents the intentional null→undefined mapping at the DB/application boundary.
// The listed keys are the nullable DB columns. If this check fails, securitySelectSchema
// is out of sync with the DB schema.
type DBSecuritySelectNullMapped = NullableKeysToOptional<
  DBSecuritySelect,
  "updatedAt" | "exchange" | "country" | "currency" | "type" | "isin" | "cusip" | "figi"
>;

securitySelectSchema._output satisfies DBSecuritySelectNullMapped;




// export type SecurityInsert = IfConstructorEquals<ZodSecurityInsert, DBSecurityInsert, never>;
// securityInsertSchema satisfies ZodType<SecurityInsert>;

