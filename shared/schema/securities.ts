import { z } from "zod";
import type {
  SecuritySelect as DBSecuritySelect,
} from "@server/db/schema/index";

export type {
  SecurityDailyHistorySelect,
} from "@server/db/schema/index"

// Security Insert Schemas
export const securityInsertSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  name: z.string().min(1, "Name is required"),
  sourceIdentifier: z.string().min(1, "Source identifier is required"),
  exchange: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  type: z.string().optional(),
  isin: z.string().optional(),
  cusip: z.string().optional(),
  figi: z.string().optional(),
});

type ZodSecurityInsert = z.infer<typeof securityInsertSchema>;
export type SecurityInsert = ZodSecurityInsert
export type SecuritySelect = DBSecuritySelect
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
