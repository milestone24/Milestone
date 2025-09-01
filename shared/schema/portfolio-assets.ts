import { optional, z, ZodObject, ZodType } from "zod";
import {
  UserAssetInsert as DBUserAssetInsert,
  UserAssetSelect as DBUserAsset,
  AssetValueInsert as DBAssetValueInsert,
  AssetValueSelect as DBAssetValueSelect,
  AssetTransactionInsert as DBAssetTransactionInsert,
  AssetTransactionSelect as DBAssetTransactionSelect,
  UserAssetSecurityInsert as DBUserAssetSecurityInsert,
  UserAssetSecuritySelect as DBUserAssetSecurity,
  UserAssetAPIKeyConnectionSelect as DBUserAssetAPIKeyConnection,
  UserAssetAPIKeyConnectionInsert as DBUserAssetAPIKeyConnectionInsert,
  BrokerProviderSelect as DBBrokerProvider,
  BrokerPlatformSelect as DBBrokerPlatform,
  RecurringContributionInsert as DBRecurringContributionInsert,
  RecurringContributionSelect as DBRecurringContributionSelect,
  ContributionInterval as DBContributionInterval,
  AccountType as DBAccountType,
} from "@server/db/schema/index";
import { ExtractCommonFields, IfConstructorEquals, Orphan } from "./utils";
import {
  securityInsertSchema,
  SecuritySearchResult,
  SecuritySelect,
} from "./securities";

// export const generalAssetOrphanInsertSchema = z.object({
//   name: z.string(),
//   currentValue: z.number().optional(),
// })

// type ZodGeneralAssetOrphan = z.infer<typeof generalAssetOrphanInsertSchema>;
// export type GeneralAssetOrphanInsert = IfConstructorEquals<ZodGeneralAssetOrphan, Orphan<DBGeneralAssetInsert>, never>;
// generalAssetOrphanInsertSchema satisfies ZodType<GeneralAssetOrphanInsert>;

// export const generalAssetInsertSchema = generalAssetOrphanInsertSchema.extend({
//   userAccountId: z.string(),
// });

// type ZodGeneralAsset = z.infer<typeof generalAssetInsertSchema>;
// export type GeneralAssetInsert = IfConstructorEquals<ZodGeneralAsset, DBGeneralAssetInsert, never>;
// generalAssetInsertSchema satisfies ZodType<GeneralAssetInsert>;

// export type GeneralAsset = DBGeneralAsset
// export type GeneralAssetWithAccountChange = WithAccountChange<GeneralAsset>

export type AccountType = DBAccountType;

export const userAssetSecurityInsertSchema = z.object({
  tempId: z.string(),
  security: securityInsertSchema,
  shareHolding: z
    .number()
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val)),
  gainLoss: z
    .number()
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val)),
  startDate: z.coerce.date(),
  recordedAt: z.coerce.date().optional(),
});

export type UserAssetInsertSecurityItem = z.infer<
  typeof userAssetSecurityInsertSchema
>;

export const userAssetOrphanInsertSchema = z.object({
  name: z.string(),
  platformId: z.string().optional(),
  providerId: z.string().optional(),

  //TODO Account type to become a wrapper type
  //wrapperType: z.string().optional(),
  accountType: z.string(),

  startDate: z.coerce.date(),

  valueMethod: z.enum(["manual", "calculated"]),

  //Only to be specified by user if the asset is to be manually updated
  currentValue: z.number().optional(),
  securities: z.array(userAssetSecurityInsertSchema),
  contributions: z.object({
    process: z.enum(["automatic", "manual"]),
    amount: z.number(),
    date: z.coerce.date(),
    securityDistribution: z.array(
      z.object({
        securityTempId: z.string(),
        securityName: z.string(),
        commitment: z.number(),
      })
    ),
    notificationPeriod: z.enum([
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
    ]),
    notificationEmail: z.boolean(),
    notificationPush: z.boolean(),
  }),
});

type ZodUserAssetOrphan = z.infer<typeof userAssetOrphanInsertSchema>;
userAssetOrphanInsertSchema satisfies ZodType<
  Omit<DBUserAssetInsert, "userAccountId">
>;
export type UserAssetOrphanInsert = ZodUserAssetOrphan;
//export type BrokerProviderAssetOrphanInsert = IfConstructorEquals<ZodBrokerProviderAssetOrphan, Orphan<DBBrokerProviderAssetInsert>, never>;
//brokerProviderAssetOrphanInsertSchema satisfies ZodType<BrokerProviderAssetOrphanInsert>;

export const userAssetInsertSchema = userAssetOrphanInsertSchema.extend({
  userAccountId: z.string(),
});

type ZodUserAssetInsert = z.infer<typeof userAssetInsertSchema>;
// export type BrokerProviderAssetInsert = IfConstructorEquals<ZodBrokerProviderAsset, DBBrokerProviderAssetInsert, never>;
// brokerProviderAssetInsertSchema satisfies ZodType<BrokerProviderAssetInsert>;
export type UserAssetInsert = ZodUserAssetInsert;

export type UserAsset = DBUserAsset;
export type UserAssetWithAccountChange = WithAccountChange<UserAsset>;

export type ResolvedUserAsset = WithPlatform<WithResolvedSecurities<UserAsset>>;

export const userAssetValueOrphanInsertSchema = z.object({
  value: z.number(),
  recordedAt: z.coerce.date(),
  valueDate: z.coerce.date(),
});

type ZodUserAssetValueOrphanInsert = z.infer<
  typeof userAssetValueOrphanInsertSchema
>;
export type UserAssetValueOrphanInsert = IfConstructorEquals<
  ZodUserAssetValueOrphanInsert,
  Omit<DBAssetValueInsert, "assetId">,
  never
>;
userAssetValueOrphanInsertSchema satisfies ZodType<UserAssetValueOrphanInsert>;

export const userAssetValueInsertSchema =
  userAssetValueOrphanInsertSchema.extend({
    assetId: z.string(),
  });

type ZodUserAssetValueInsert = z.infer<typeof userAssetValueInsertSchema>;
export type UserAssetValueInsert = IfConstructorEquals<
  ZodUserAssetValueInsert,
  DBAssetValueInsert,
  never
>;
userAssetValueInsertSchema satisfies ZodType<UserAssetValueInsert>;

export type AssetValue = DBAssetValueSelect;

// export const assetDebitOrphanInsertSchema = z.object({
//   value: z.number(),
//   recordedAt: z.coerce.date(),
// })

// type ZodAssetDebitOrphanInsert = z.infer<typeof assetDebitOrphanInsertSchema>;
// export type AssetDebitOrphanInsert = IfConstructorEquals<ZodAssetDebitOrphanInsert, Omit<DBAssetDebitInsert, "assetId">, never>;
// assetDebitOrphanInsertSchema satisfies ZodType<AssetDebitOrphanInsert>;

// export const assetDebitInsertSchema = assetDebitOrphanInsertSchema.extend({
//   assetId: z.string()
// })

// type ZodAssetDebitInsert = z.infer<typeof assetDebitInsertSchema>;
// export type AssetDebitInsert = IfConstructorEquals<ZodAssetDebitInsert, DBAssetDebitInsert, never>;
// assetDebitInsertSchema satisfies ZodType<AssetDebitInsert>;

// export type AssetDebit = DBAssetDebitSelect;

/* Transaction */

export type AssetTransaction = DBAssetTransactionSelect;

export const userAssetTransactionOrphanInsertSchema = z.object({
  value: z.number(),
  valueDate: z.coerce.date(),
  //TODO
  //The currency information will need to be added and not optional eventually
  currencyValue: z.number().optional(),
  fees: z.number().optional(),
  currency: z.string().optional(),
  recordedAt: z.coerce.date().optional(),
});

type ZodUserAssetTransactionOrphanInsert = z.infer<
  typeof userAssetTransactionOrphanInsertSchema
>;
export type UserAssetTransactionOrphanInsert = IfConstructorEquals<
  ZodUserAssetTransactionOrphanInsert,
  Omit<DBAssetTransactionInsert, "assetId" | "recordedAt"> & {
    recordedAt?: Date;
  },
  never
>;

userAssetTransactionOrphanInsertSchema satisfies ZodType<UserAssetTransactionOrphanInsert>;

/* Contribution */

/**
 * Asset Contributions is a term used in the UI only.
 * In the backend, we use AssetTransactions to represent contributions and debits.
 * The term "Contributions" is used in the backend only for use in recurring contributions
 * but they would translate to a positive value in the AssetTransactions table.
 */

export const assetContributionOrphanInsertSchema = z.object({
  value: z.number(),
  valueDate: z.coerce.date(),
  currencyValue: z.number().optional(),
  fees: z.number().optional(),
  currency: z.string().optional(),
});

type ZodAssetContributionOrphanInsert = z.infer<
  typeof assetContributionOrphanInsertSchema
>;
export type AssetContributionOrphanInsert = IfConstructorEquals<
  ZodAssetContributionOrphanInsert,
  Omit<DBAssetTransactionInsert, "assetId" | "recordedAt">,
  never
>;
assetContributionOrphanInsertSchema satisfies ZodType<AssetContributionOrphanInsert>;

export const assetContributionInsertSchema =
  assetContributionOrphanInsertSchema.extend({
    assetId: z.string(),
  });

type ZodAssetContributionInsert = z.infer<typeof assetContributionInsertSchema>;
export type AssetContributionInsert = IfConstructorEquals<
  ZodAssetContributionInsert,
  Omit<DBAssetTransactionInsert, "recordedAt">,
  never
>;
assetContributionInsertSchema satisfies ZodType<AssetContributionInsert>;

export type AssetContribution = DBAssetTransactionSelect;

export type ContributionInterval = DBContributionInterval;

export const recurringContributionOrphanInsertSchema = z.object({
  amount: z.number().positive(),
  startDate: z.coerce.date(),
  interval: z.enum(["weekly", "biweekly", "monthly", "quarterly", "yearly"]),
});

type ZodRecurringContributionOrphanInsert = z.infer<
  typeof recurringContributionOrphanInsertSchema
>;
export type RecurringContributionOrphanInsert = IfConstructorEquals<
  ZodRecurringContributionOrphanInsert,
  Omit<
    DBRecurringContributionInsert,
    "isActive" | "lastProcessedDate" | "assetId"
  >,
  never
>;
recurringContributionOrphanInsertSchema satisfies ZodType<RecurringContributionOrphanInsert>;

export const recurringContributionInsertSchema =
  recurringContributionOrphanInsertSchema.extend({
    assetId: z.string(),
  });

type ZodRecurringContributionInsert = z.infer<
  typeof recurringContributionInsertSchema
>;
export type RecurringContributionInsert = IfConstructorEquals<
  ZodRecurringContributionInsert,
  Omit<DBRecurringContributionInsert, "isActive" | "lastProcessedDate">,
  never
>;
recurringContributionInsertSchema satisfies ZodType<RecurringContributionInsert>;

export type RecurringContribution = DBRecurringContributionSelect;

export type PotfolioValue = {
  totalValue: number;
  totalChange: number;
  totalChangePercentage: number;
};

export type AssetHistoryTimePoint = {
  date: Date;
  value: number;
  changes: {
    assetId: UserAsset["id"];
    previousValue: number;
    newValue: number;
    change: number;
  }[];
  metadata?: Record<string, unknown>;
};

/**
 * @deprecated Alias for AssetHistoryTimePoint - Use AssetHistoryTimePoint instead
 */
export type PortfolioHistoryTimePoint = AssetHistoryTimePoint;

export type UserAssetAPIKeyConnection = DBUserAssetAPIKeyConnection;

export type BrokerPlatform = DBBrokerPlatform;

export type BrokerProvider = DBBrokerProvider;

export type UserAssetSecuritySelect = DBUserAssetSecurity & {
  security: SecuritySelect;
};
export type UserAssetSecurityInsert = DBUserAssetSecurityInsert;

export type CalculatedValue = {
  value: number;
  currentChange: number;
  currentChangePercentage: number;
};

export type AssetsChange = CalculatedValue & {
  startDate: Date | null;
  endDate: Date | null;
  startValue: number;
  value: number;
};

export type WithCalculatedValue<T extends { id: string }> = T & {
  calculatedValue: CalculatedValue;
};

export type WithAccountChange<T extends { id: string }> = T & {
  accountChange: AssetsChange;
};
export type WithAssetHistory<T extends { id: string }> = T & {
  history: AssetValue[];
};

export type WithSecurity<T extends { id: string }> = T & {
  security: SecuritySelect;
};

export type WithSecurities<T extends { id: string }> = T & {
  securities: WithSecurity<UserAssetSecuritySelect>[];
};

export type WithResolvedSecurities<T extends { id: string }> = T & {
  securities: ResolvedSecurity[];
};

export type ResolvedSecurity = WithSecurity<UserAssetSecuritySelect>;

export type WithPlatform<T extends { id: string }> = T & {
  platform?: BrokerPlatform;
};

//This is used when a dummy asset value is needed for a date range that is before the first asset value
export type PossibleDummyAssetValue = Omit<AssetValue, "id"> & {
  id: string | null;
};

export type DataRangeQuery = {
  start: Date | string | null;
  end: Date | string | null;
};

export type AssetWithHistory = {
  id: string;
  history: AssetValue[];
};

export type AssetHistoryPoint = {
  id: string;
  type: "value" | "transaction";
  value: number;
  recordedAt: Date;
};

export type SecurityHistoryPoint = {
  id: string;
  quantity: number;
  value: number;
  recordedAt: Date;
};

//We have pluralised Iterators because later the asset
//may contain more than one field that requires iteration for streaming
export type AssetWithHistoryIterators = {
  id: string;
  history: Iterator<AssetHistoryPoint>;
};

export type AssetWithHistoryAsyncIterators = {
  id: string;
  history: AsyncIterator<AssetHistoryPoint>;
};

export type AssetWithHistoryGenerators = {
  id: string;
  history: Generator<AssetHistoryPoint>;
};

//We have pluralised Iterators because later the asset
//may contain more than one field that requires iteration for streaming
export type AssetWithValueHistoryIterators = {
  id: string;
  history: Iterator<AssetValue>;
};

export type AssetWithValueHistoryAsyncIterators = {
  id: string;
  history: AsyncIterator<AssetValue>;
};

export type AssetWithValueHistoryGenerators = {
  id: string;
  history: Generator<AssetValue>;
};
