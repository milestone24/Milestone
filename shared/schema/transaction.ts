import { z, ZodType } from "zod";
import {
  decimalValueSchema,
  recurringContributionProcessTypes,
} from "@server/db/schema";
import type {
  RecurringContributionInsert as DBRecurringContributionInsert,
  RecurringContributionSelect as DBRecurringContributionSelect,
  AssetTransactionInsert as DBAssetTransactionInsert,
  AssetTransactionSelect as DBAssetTransactionSelect,
  SecurityTransactionInsert as DBSecurityTransactionInsert,
  SecurityTransactionSelect as DBSecurityTransactionSelect,
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

/*
AssetTransaction
*/

export type AssetTransaction = Omit<
  DBAssetTransactionSelect,
  "value" | "currencyValue"
> & {
  value: DecimalValueString;
  currencyValue: DecimalValueString;
};

export const userAssetTransactionOrphanInsertSchema = z.object({
  value: decimalValueSchema,
  valueDate: z.coerce.date(),
  //TODO
  //The currency information will need to be added and not optional eventually
  currencyValue: decimalValueSchema.optional(),
  fees: decimalValueSchema.optional(),
  currency: z.string().optional(),
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
  value: decimalValueSchema,
  currencyValue: decimalValueSchema,
  fees: decimalValueSchema.optional(),
  currency: z.string().optional(),
  valueDate: z.coerce.date(),
  recordedAt: z.coerce.date().optional(),
});

securityTransactionOrphanInsertSchema._output satisfies Omit<
  DBSecurityTransactionInsert,
  "assetSecurityId" | "recordedAt"
>;

export type SecurityTransactionOrphanInsert = z.infer<
  typeof securityTransactionOrphanInsertSchema
>;

export type SecurityTransactionSelect = DBSecurityTransactionSelect;

export const securityTransactionInsertSchema =
  securityTransactionOrphanInsertSchema.extend({
    assetSecurityId: z.string(),
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
  amount: decimalValueSchema,
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
