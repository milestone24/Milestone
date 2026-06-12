import { z, ZodType } from "zod";
import {
  //decimalValueSchema,
  recurringContributionProcessTypes,
  recurringContributionTypes,
  assetTransactionSources,
  securityTransactionSources,
} from "@milestone/data/schema";

export { assetTransactionSources, securityTransactionSources } from "@milestone/data/schema";
export type { AssetTransactionSource, SecurityTransactionSource } from "@milestone/data/schema";
import type {
  RecurringContributionInsert as DBRecurringContributionInsert,
  RecurringContributionSelect as DBRecurringContributionSelect,
  AssetTransactionInsert as DBAssetTransactionInsert,
  AssetTransactionSelect as DBAssetTransactionSelect,
  SecurityTransactionInsert as DBSecurityTransactionInsert,
  SecurityTransactionSelect as DBSecurityTransactionSelect,
  AssetTransactionFlags,
} from "@milestone/data/schema";
import {
  decimalValueSchema,
  createDecimalValueString,
  currencyNonZeroSchema,
  currencyGreaterThanZeroSchema,
  DecimalValueString,
  isDecimalValueString,
  shareQuantityNoneZeroSchema,
  shareValueNoneZeroSchema,
  maxDecimalPlaces,
} from "./decimal-value";
import { BrandedValue, ValueAbstract, ValueAbstractType } from "./common";
import { securitySearchResultSchema } from "./securities";

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
  perUnitValue: decimalValueSchema.nullable().optional(),
  fees: decimalValueSchema.nullable().optional(),
  taxes: decimalValueSchema.nullable().optional(),
  source: z.enum(assetTransactionSources).optional(),
  flags: assetTransactionFlagsSchema.nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  groupId: z.string().uuid().nullable().optional(),
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
  ledgerGroupId: z.string().uuid().nullable(),
  // TODO: replace createdAt/updatedAt with a shared timestamp fields schema when one is available
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

assetTransactionSelectSchema._output satisfies AssetTransaction;

export const userAssetTransactionOrphanInsertSchema = z.object({
  value: currencyNonZeroSchema,
  valueDate: z.coerce.date(),
  //TODO
  //The currency information will need to be added and not optional eventually
  currencyValue: currencyNonZeroSchema
    .optional(),
  fees: currencyGreaterThanZeroSchema
    .optional(),
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
  currencyValue: decimalValueSchema
    .refine(maxDecimalPlaces(2), { message: "Currency value must not exceed 2 decimal places" })
    .optional(),
  fees: decimalValueSchema
    .refine(maxDecimalPlaces(2), { message: "Fees must not exceed 2 decimal places" })
    .optional(),
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
  value: shareQuantityNoneZeroSchema,
  perUnitValue: shareValueNoneZeroSchema,
  currencyValue: currencyNonZeroSchema,
  fees: currencyNonZeroSchema.optional(),
  taxes: currencyNonZeroSchema.optional(),
  currency: z.string().optional(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date().optional(),
  source: z.enum(securityTransactionSources).optional(),
  flags: assetTransactionFlagsSchema.optional(),
  fundedFromCash: z.boolean().optional(),
});

securityTransactionOrphanInsertSchema._output satisfies Omit<
  DBSecurityTransactionInsert,
  "assetSecurityId" | "recordedAt"
>;

export type SecurityTransactionOrphanInsert = z.infer<
  typeof securityTransactionOrphanInsertSchema
>;

export type SecurityTransactionSelect = DBSecurityTransactionSelect;

export const existingSecurityTransactionInsertSchema = securityTransactionOrphanInsertSchema.extend({
  mode: z.literal("existing"),
  assetSecurityId: z.string().refine((value) => value !== "", {
    message: "Security is required",
  }),
  //This is only here to satisfy the the union with .
  ledgerGroupId: z.string().uuid().optional(),
});

existingSecurityTransactionInsertSchema._output satisfies Omit<
  DBSecurityTransactionInsert,
  "recordedAt"
>;

export const newSecurityTransactionInsertSchema = securityTransactionOrphanInsertSchema.extend({
  mode: z.literal("new"),
  security: securitySearchResultSchema.refine((value) => value !== null && value !== undefined, {
    message: "Security is required",
  }),
  ledgerGroupId: z.literal(undefined),
});

export const securityTransactionInsertSchema = z.discriminatedUnion("mode", [
  existingSecurityTransactionInsertSchema,
  newSecurityTransactionInsertSchema,
])

export type SecurityTransactionInsert = z.infer<
  typeof securityTransactionInsertSchema
  >

export const securityTransactionMutateSchema = securityTransactionOrphanInsertSchema.extend({
  mode: z.literal("existing"),
  assetSecurityId: z.string().refine((value) => value !== "", {
    message: "Security is required",
  }),
  ledgerGroupId: z.string().uuid().optional()
});

export type SecurityTransactionMutate = z.infer<typeof securityTransactionMutateSchema>;

export type SecurityTransactionUpsert = SecurityTransactionInsert | SecurityTransactionMutate;

export const securityTransactionSelectSchema = z.object({
  id: z.string(),
  assetSecurityId: z.string(),
  value: decimalValueSchema,
  currencyValue: decimalValueSchema,
  perUnitValue: decimalValueSchema,
  fees: decimalValueSchema.nullable(),
  taxes: decimalValueSchema.nullable(),
  currency: z.string(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date(),
  source: z.enum(securityTransactionSources),
  flags: assetTransactionFlagsSchema.nullable(),
  ledgerGroupId: z.string().uuid().nullable(),
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
  amount: currencyGreaterThanZeroSchema,
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
  amount: currencyGreaterThanZeroSchema,
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

export const transactionBundleInsertSchema = z.object({
  securityLeg: securityTransactionInsertSchema,
  cashLeg: assetContributionOrphanInsertSchema.optional(),
});

export type TransactionBundleInsert = z.infer<typeof transactionBundleInsertSchema>;

export const transactionBundleResponseSchema = z.object({
  groupId: z.string().uuid(),
  securityLeg: securityTransactionSelectSchema,
  cashLeg: assetTransactionSelectSchema.optional(),
});

export type TransactionBundleResponse = z.infer<typeof transactionBundleResponseSchema>;
