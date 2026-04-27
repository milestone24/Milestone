import { z, ZodType } from "zod";
import {
  decimalValueSchema,
  decimalValueNonZeroSchema,
  decimalValueSchemaRequiredGreaterThanZero,
  recurringContributionProcessTypes,
  recurringContributionTypes,
  assetTransactionSources,
} from "@server/db/schema";
import type {
  RecurringContributionInsert as DBRecurringContributionInsert,
  RecurringContributionSelect as DBRecurringContributionSelect,
  AssetTransactionInsert as DBAssetTransactionInsert,
  AssetTransactionSelect as DBAssetTransactionSelect,
  SecurityTransactionInsert as DBSecurityTransactionInsert,
  SecurityTransactionSelect as DBSecurityTransactionSelect,
  AssetTransactionFlags,
} from "@server/db/schema";
import {
  createDecimalValueString,
  DecimalValueString,
  IfConstructorEquals,
  isDecimalValueString,
} from "./utils";
import { BrandedValue, ValueAbstract, ValueAbstractType } from "./common";

export const patternSchema = z.object({
  type: z.enum(["cron", "rrule"]),
  expression: z.string(),
  timezone: z.string().optional(),
});

export type SchedulePatternInsert = z.infer<typeof patternSchema>;

export const assetTransactionFlagsSchema = z.object({
  estimated: z.boolean().optional(),
  suspect: z.boolean().optional(),
  verified: z.boolean().optional(),
});

assetTransactionFlagsSchema._output satisfies AssetTransactionFlags;

export type AssetTransactionFlagsInsert = z.infer<
  typeof assetTransactionFlagsSchema
>;

export type TransactionType = "asset" | "security" | "synthetic";

export type TransactionAbstract = ValueAbstract & {
  assetId: string;
  id: string;
  transactionType: TransactionType;
  recordedAt: Date;
  value: DecimalValueString;
  valueDate: Date;
  currencyValue: DecimalValueString;
  //accumalted security level, not asset level
  accumulativeAssetCurrencyValue: DecimalValueString;
  accumulativeAssetCurrencyValueRow: number;
  //assetAccumalitiveCurrencyValue: number;
  currency: string;
};

/**
 * A row in `asset_transactions`: **account-level** cash movement (not a security line).
 * `currencyValue` is the signed amount in `currency` (inflow positive, outflow negative).
 * Maps to the abstract transaction stream with `transactionType: "asset"`.
 */
export type AssetTransaction = Omit<
  DBAssetTransactionSelect,
  "value" | "currencyValue"
> & {
  value: DecimalValueString;
  currencyValue: DecimalValueString;
};

export const transactionAbstractSchema = z.object({
  value: decimalValueSchema,
  valueDate: z.coerce.date(),
  assetId: z.string(),
  id: z.string(),
  transactionType: z.enum(["asset", "security", "synthetic"] as const),
  recordedAt: z.coerce.date(),
  currencyValue: decimalValueSchema,
  accumulativeAssetCurrencyValue: decimalValueSchema,
  accumulativeAssetCurrencyValueRow: z.coerce.number(),
  currency: z.string(),
});

transactionAbstractSchema._output satisfies TransactionAbstract;

/**
 * One row from `GET /api/assets/:assetId/transactions` (merged security + asset lines,
 * same accumulator fields as the combined stream; no synthetic/boundary-only rows).
 */
export const flatCombinedTransactionRowSchema = transactionAbstractSchema.extend({
  assetSecurityId: z.string().optional(),
  fees: decimalValueSchema.nullable().optional(),
  source: z.enum(assetTransactionSources).optional(),
  flags: assetTransactionFlagsSchema.nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type FlatCombinedTransactionRow = z.infer<
  typeof flatCombinedTransactionRowSchema
>;

export const assetTransactionSelectSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  value: decimalValueSchema,
  currencyValue: decimalValueSchema,
  fees: decimalValueSchema,
  currency: z.string(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date(),
  source: z.enum(assetTransactionSources),
  flags: assetTransactionFlagsSchema.nullable(),
  // TODO: replace createdAt/updatedAt with a shared timestamp fields schema when one is available
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

assetTransactionSelectSchema._output satisfies AssetTransaction;

export const userAssetTransactionOrphanInsertSchema = z.object({
  value: decimalValueSchema,
  valueDate: z.coerce.date(),
  //TODO
  //The currency information will need to be added and not optional eventually
  currencyValue: decimalValueSchema.optional(),
  fees: decimalValueSchema.optional(),
  currency: z.string().optional(),
  source: z.enum(assetTransactionSources).optional(),
  flags: assetTransactionFlagsSchema.optional(),
});

userAssetTransactionOrphanInsertSchema._output satisfies Omit<
  DBAssetTransactionInsert,
  "assetId" | "recordedAt"
> & {
  recordedAt?: Date;
};

export type UserAssetTransactionOrphanInsert = z.infer<
  typeof userAssetTransactionOrphanInsertSchema
>;

/* Contribution */

/**
 * Asset Contributions is a term used in the UI only.
 * In the backend, we use AssetTransactions to represent contributions and debits.
 * The term "Contributions" is used in the backend only for use in recurring contributions
 * but they would translate to a positive value in the AssetTransactions table.
 */

export const assetContributionOrphanInsertSchema = z.object({
  value: z.string().refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  valueDate: z.coerce.date(),
  currencyValue: decimalValueSchema.optional(),
  fees: decimalValueSchema.optional(),
  currency: z.string().optional(),
  source: z.enum(assetTransactionSources).optional(),
  flags: assetTransactionFlagsSchema.optional(),
});

assetContributionOrphanInsertSchema._output satisfies Omit<
  DBAssetTransactionInsert,
  "assetId" | "recordedAt"
>;

type AssetContributionOrphanInsert = z.input<
  typeof assetContributionOrphanInsertSchema
>;

export type AssetContributionFormData = Pick<
  AssetContributionOrphanInsert,
  "value" | "valueDate"
>;

export const assetContributionInsertSchema =
  assetContributionOrphanInsertSchema.extend({
    assetId: z.string(),
  });

assetContributionInsertSchema._output satisfies Omit<
  DBAssetTransactionInsert,
  "recordedAt"
>;

export type AssetContributionInsert = z.infer<
  typeof assetContributionInsertSchema
>;

/*
SecurityTransaction
*/

export type SecurityTransaction = DBSecurityTransactionSelect;

export const securityTransactionOrphanInsertSchema = z.object({
  value: decimalValueNonZeroSchema,
  currencyValue: decimalValueNonZeroSchema,
  fees: decimalValueSchema.optional(),
  currency: z.string().optional(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date().optional(),
  source: z.enum(assetTransactionSources).optional(),
  flags: assetTransactionFlagsSchema.optional(),
});

securityTransactionOrphanInsertSchema._output satisfies Omit<
  DBSecurityTransactionInsert,
  "assetSecurityId" | "recordedAt"
>;

export type SecurityTransactionOrphanInsert = z.infer<
  typeof securityTransactionOrphanInsertSchema
>;

/** Optional identity fields an OCR model may emit before `assetSecurityId` resolution. */
export type OcrSecurityIdentityFieldKey = "name" | "isin" | "symbol";

export type OcrSecurityIdentityShape = Partial<
  Record<OcrSecurityIdentityFieldKey, string | undefined>
>;

/**
 * How to combine {@link OcrSecurityIdentityRule.fields}:
 * - `all`: every listed field must be non-empty after trim (AND).
 * - `any`: at least one listed field must be non-empty (OR).
 */
export type OcrSecurityIdentityRule = {
  fields: readonly OcrSecurityIdentityFieldKey[];
  mode: "all" | "any";
};

function isOcrSecurityIdentityFieldPresent(
  v: OcrSecurityIdentityShape,
  field: OcrSecurityIdentityFieldKey
): boolean {
  const s = v[field];
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Returns a predicate closed over `rule` for use in Zod `.refine` or manual checks.
 * Change {@link securityTransactionOcrIdentityRule} to adjust product requirements
 * (e.g. add `isin` or switch to `mode: "any"`).
 */
export function createOcrSecurityIdentityPredicate(
  rule: OcrSecurityIdentityRule
): (v: OcrSecurityIdentityShape) => boolean {
  return (v) => {
    if (rule.fields.length === 0) return false;
    if (rule.mode === "all") {
      return rule.fields.every((f) => isOcrSecurityIdentityFieldPresent(v, f));
    }
    return rule.fields.some((f) => isOcrSecurityIdentityFieldPresent(v, f));
  };
}

const OCR_SECURITY_IDENTITY_FIELD_LABEL: Record<
  OcrSecurityIdentityFieldKey,
  string
> = {
  name: "name",
  isin: "ISIN",
  symbol: "symbol",
};

/** User-facing Zod message for a given rule (keeps copy in one place). */
export function ocrSecurityIdentityRuleRefinementMessage(
  rule: OcrSecurityIdentityRule
): string {
  const parts = rule.fields.map((f) => OCR_SECURITY_IDENTITY_FIELD_LABEL[f]);
  if (parts.length === 0) return "Identity fields are required";
  if (rule.mode === "any") {
    if (parts.length === 1) return `${parts[0]} is required`;
    return `At least one of ${parts.join(", ")} is required`;
  }
  if (parts.length === 1) return `${parts[0]} is required`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]} are required`;
  const last = parts[parts.length - 1]!;
  return `${parts.slice(0, -1).join(", ")}, and ${last} are required`;
}

/**
 * Product default: resolvers lean on **name + symbol**; ISIN is optional on the object
 * but not part of the required set until matching supports it.
 */
export const securityTransactionOcrIdentityRule: OcrSecurityIdentityRule = {
  fields: ["name", "symbol"],
  mode: "all",
};

const matchesSecurityTransactionOcrIdentity = createOcrSecurityIdentityPredicate(
  securityTransactionOcrIdentityRule
);

const securityTransactionOcrIdentityRefineMessage =
  ocrSecurityIdentityRuleRefinementMessage(securityTransactionOcrIdentityRule);

/**
 * Identity read from a statement for resolving `assetSecurityId` (not stored on
 * `security_transactions` — use {@link securityTransactionOcrRowToInsert} after lookup).
 */
export const securityTransactionOcrSecurityIdentitySchema = z
  .object({
    /** As printed on the statement (fund or security name). */
    name: z.string().optional(),
    isin: z.string().optional(),
    symbol: z.string().optional(),
  })
  .refine(matchesSecurityTransactionOcrIdentity, {
    message: securityTransactionOcrIdentityRefineMessage,
  });

/**
 * One OCR row that **uses the same value shapes** as {@link securityTransactionOrphanInsertSchema}
 * for every insertable column the model can fill, plus identity and audit fields.
 *
 * After validation: {@link securityTransactionOcrRowToOrphanInsert} yields a value assignable to
 * {@link SecurityTransactionOrphanInsert} (with `source: "ocr"`). With a resolved
 * `assetSecurityId`, {@link securityTransactionOcrRowToInsert} yields {@link SecurityTransactionInsert}.
 *
 * The model must **not** emit `source`, `flags`, or `assetSecurityId`; those are app-owned.
 */
export const securityTransactionOcrExtractionRowSchema =
  securityTransactionOrphanInsertSchema
    .pick({
      value: true,
      currencyValue: true,
      fees: true,
      currency: true,
      valueDate: true,
      recordedAt: true,
    })
    .extend({
      name: z.string().optional(),
      isin: z.string().optional(),
      symbol: z.string().optional(),
      confidence: z.number().min(0).max(1),
      evidenceSnippet: z.string().optional(),
    })
    .refine(matchesSecurityTransactionOcrIdentity, {
      message: securityTransactionOcrIdentityRefineMessage,
    });

export type SecurityTransactionOcrExtractionRow = z.infer<
  typeof securityTransactionOcrExtractionRowSchema
>;

export const securityTransactionOcrExtractionListSchema = z.array(
  securityTransactionOcrExtractionRowSchema
);

/**
 * One OCR security row as evaluated under a specific user asset candidate.
 * Every asset candidate lists **all** document rows; `matched` indicates whether
 * that row mapped to a holding within that asset. `verified` reflects the schema
 * gate (4b) — rows already in the pipeline are typically `true` after Zod parse.
 */
export const ocrAssetCandidateSecuritySchema = z
  .object({
    ocrRow: securityTransactionOcrExtractionRowSchema,
    verified: z.boolean(),
    matched: z.boolean(),
    userAssetSecurityId: z.string().uuid().nullable(),
  })
  .refine((s) => !s.matched || s.userAssetSecurityId !== null, {
    message: "userAssetSecurityId is required when matched is true",
  });

export type OcrAssetCandidateSecurity = z.infer<typeof ocrAssetCandidateSecuritySchema>;

/**
 * One user asset (account) evaluated as a candidate for explaining the statement.
 * `securities` contains every OCR row from the document — same length and order
 * across all asset candidates in a result. `matchedCount` / `totalCount` are
 * denormalised for decision logic (e.g. auto-insert when exactly one asset has
 * `matchedCount === totalCount`).
 */
export const ocrAssetCandidateResultSchema = z
  .object({
    userAssetId: z.string().uuid(),
    assetName: z.string(),
    /** `user_assets.platform_id` for this account; null if unset. */
    userAssetPlatformId: z.string().uuid().nullable().default(null),
    /**
     * True when brand verification found a platform and this account is assigned to
     * the same `broker_platforms` row as the matched statement.
     */
    alignsWithMatchedStatementPlatform: z.boolean().default(false),
    matchedCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    securities: z.array(ocrAssetCandidateSecuritySchema),
  })
  .refine((v) => v.matchedCount <= v.totalCount, {
    message: "matchedCount must not exceed totalCount",
  })
  .refine((v) => v.securities.length === v.totalCount, {
    message: "securities length must equal totalCount",
  });

export type OcrAssetCandidateResult = z.infer<typeof ocrAssetCandidateResultSchema>;

export const ocrAssetCandidateResultListSchema = z.array(ocrAssetCandidateResultSchema);

/**
 * Strips OCR-only fields and sets `source: "ocr"` for persistence.
 */
export function securityTransactionOcrRowToOrphanInsert(
  row: SecurityTransactionOcrExtractionRow
): SecurityTransactionOrphanInsert {
  return {
    value: row.value,
    currencyValue: row.currencyValue,
    fees: row.fees,
    currency: row.currency,
    valueDate: row.valueDate,
    recordedAt: row.recordedAt,
    source: "ocr",
  };
}

/**
 * Builds a full row for {@link securityTransactions} after identity resolution.
 */
export function securityTransactionOcrRowToInsert(
  row: SecurityTransactionOcrExtractionRow,
  assetSecurityId: string
): SecurityTransactionInsert {
  return {
    ...securityTransactionOcrRowToOrphanInsert(row),
    assetSecurityId,
  };
}

export type SecurityTransactionSelect = DBSecurityTransactionSelect;

export const securityTransactionInsertSchema =
  securityTransactionOrphanInsertSchema.extend({
    assetSecurityId: z.string().refine((value) => value !== "", {
      message: "Security is required",
    }),
  });

securityTransactionInsertSchema._output satisfies Omit<
  DBSecurityTransactionInsert,
  "recordedAt"
>;

export type SecurityTransactionInsert = z.infer<
  typeof securityTransactionInsertSchema
>;

export type SecurityTransactionUpsert = SecurityTransactionInsert & {
  id?: string;
};

export const securityTransactionSelectSchema = z.object({
  id: z.string(),
  assetSecurityId: z.string(),
  value: decimalValueSchema,
  currencyValue: decimalValueSchema,
  fees: decimalValueSchema.nullable(),
  currency: z.string(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date(),
  source: z.enum(assetTransactionSources),
  flags: assetTransactionFlagsSchema.nullable(),
  // TODO: replace createdAt/updatedAt with a shared timestamp fields schema when one is available
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const userAssetSecurityTransactionResolvedSchema =
  securityTransactionSelectSchema.extend({
    securityName: z.string(),
  });

export type UserAssetSecurityTransactionResolved = SecurityTransactionSelect & {
  securityName: string;
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

// export const recurringContributionOrphanSchema = z.object({
//   amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
//     message: "Amount must be a positive number",
//   }),
//   startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
//     message: "Invalid date",
//   }),
//   patternConfig: patternSchema.required(),
//   // interval: z.enum(["weekly", "biweekly", "monthly"], {
//   //   required_error: "Interval is required",
//   // }),
//   isActive: z.boolean().default(true),
// });

// export type RecurringContributionOrphanInsert = z.infer<
//   typeof recurringContributionOrphanSchema
// >;

export const recurringContributionOrphanInsertSchemaBase = z.object({
  amount: decimalValueSchemaRequiredGreaterThanZero,
  process: z.enum(recurringContributionProcessTypes),
  startDate: z.coerce.date(),
  patternConfig: patternSchema,
  notificationEmail: z.boolean().optional().default(false),
  notificationPush: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const recurringAssetContributionOrphanInsertSchema =
  recurringContributionOrphanInsertSchemaBase.extend({
    type: z.literal("asset"),
  });

export const recurringSecurityContributionOrphanInsertSchema =
  recurringContributionOrphanInsertSchemaBase.extend({
    type: z.literal("security"),
    securityId: z.string(),
    groupId: z.string().optional(),
  });

export const recurringContributionOrphanInsertSchema = z.discriminatedUnion(
  "type",
  [
    recurringAssetContributionOrphanInsertSchema,
    recurringSecurityContributionOrphanInsertSchema,
  ]
);

recurringContributionOrphanInsertSchema._output satisfies Omit<
  DBRecurringContributionInsert,
  "isActive" | "lastProcessedDate" | "assetId"
>;

export type RecurringContributionOrphanInsert = z.infer<
  typeof recurringContributionOrphanInsertSchema
>;

export type RecurringContribution = DBRecurringContributionSelect;

export const recurringContributionSelectSchema = z.object({
  id: z.string(),
  groupId: z.string().nullable(),
  type: z.enum(recurringContributionTypes),
  process: z.enum(recurringContributionProcessTypes),
  assetId: z.string(),
  securityId: z.string().nullable(),
  amount: decimalValueSchema.refine(isDecimalValueString, {
    message: "Amount must be a valid decimal string",
  }),
  startDate: z.coerce.date(),
  patternConfig: patternSchema,
  lastProcessedDate: z.coerce.date().nullable(),
  isActive: z.boolean(),
  notificationEmail: z.boolean(),
  notificationPush: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

recurringContributionSelectSchema._output satisfies RecurringContribution;

export type RecurringContributionFormData = Omit<
  RecurringContributionOrphanInsert,
  "type"
>;

export const recurringContributionInsertSchema = z.discriminatedUnion("type", [
  recurringAssetContributionOrphanInsertSchema.extend({
    assetId: z.string(),
  }),
  recurringSecurityContributionOrphanInsertSchema.extend({
    assetId: z.string(),
  }),
]);

recurringContributionInsertSchema._output satisfies Omit<
  DBRecurringContributionInsert,
  "isActive" | "lastProcessedDate" | "groupId"
>;

export type RecurringContributionInsert = z.input<
  typeof recurringContributionInsertSchema
>;

export type BrandedAssetTransactionValue = BrandedValue<
  AssetTransaction,
  Extract<ValueAbstractType, "transaction">
>;

export type BrandedAbstractTransactionValue = BrandedValue<
  TransactionAbstract,
  Extract<ValueAbstractType, "transaction">
>;

export const isSingleContributionFormData = (
  data: AssetContributionFormData | RecurringContributionFormData
): data is AssetContributionFormData => {
  return "value" in data;
};

export const isRecurringContributionFormData = (
  data: AssetContributionFormData | RecurringContributionFormData
): data is RecurringContributionFormData => {
  return "amount" in data && "startDate" in data && "patternConfig" in data;
};

export const isAssetContribution = (
  data: AssetTransaction | RecurringContribution
): data is AssetTransaction => {
  return "value" in data && "recordedAt" in data;
};

export const isRecurringContribution = (
  data: AssetTransaction | RecurringContribution
): data is RecurringContribution => {
  return "amount" in data && "startDate" in data && "patternConfig" in data;
};

export const securityDistributionInsertSchema = z.object({
  securityId: z.string(),
  isTempSecurityId: z.boolean(),
  securityName: z.string(),
  commitment: decimalValueSchema,
  groupId: z.string().optional(),
});

/**
 * Schema for bulk creating distributed recurring contributions
 * for an existing asset's securities (not during asset creation)
 */
export const recurringContributionBulkInsertSchema =
  recurringContributionOrphanInsertSchemaBase.extend({
    securityDistribution: z.array(
      z.object({
        securityId: z.string(),
        commitment: decimalValueSchema, // Percentage (0-100)
      })
    ),
  });

export type RecurringContributionBulkInsert = z.infer<
  typeof recurringContributionBulkInsertSchema
>;

export const recurringContributionGroupInsertSchemaSecurityDistribution =
  recurringContributionOrphanInsertSchemaBase.extend({
    type: z.literal("security"),
    securityDistribution: z.array(securityDistributionInsertSchema),
  });

export const recurringContributionGroupInsertSchemaAssetDistribution =
  recurringContributionOrphanInsertSchemaBase.extend({
    type: z.literal("asset"),
  });

export const recurringContributionGroupInsertSchema = z.discriminatedUnion(
  "type",
  [
    recurringContributionGroupInsertSchemaSecurityDistribution,
    recurringContributionGroupInsertSchemaAssetDistribution,
  ]
);

export type RecurringContributionGroupInsert = z.input<
  typeof recurringContributionGroupInsertSchema
>;

export type RecurringContributionGroupInsertSecurityDistribution = z.input<
  typeof recurringContributionGroupInsertSchemaSecurityDistribution
>;

export type RecurringContributionGroupInsertAssetDistribution = z.input<
  typeof recurringContributionGroupInsertSchemaAssetDistribution
>;

export type AssetSecurityLike = {
  id: string;
  isTempSecurityId?: boolean;
  security: {
    name: string;
  };
};
