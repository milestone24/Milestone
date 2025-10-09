import {
  pgTable,
  text,
  timestamp,
  boolean,
  real,
  pgEnum,
  check,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { userAccounts } from "./user-account";
import { InferInsertModelBasic, timestampColumns, slugify } from "./utils";
import { relations, InferSelectModel, sql } from "drizzle-orm";
import { IncludeRelation } from "../types/utils";
import { InferResultType } from "../types/utils";
import { securities, securityDailyHistory } from "./securities";
export const accountType = ["ISA", "CISA", "SIPP", "LISA", "GIA"] as const;
export const accountTypeEnum = pgEnum("account_type", accountType);
export const contributionInterval = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export const contributionIntervalEnum = pgEnum(
  "contribution_interval",
  contributionInterval
);
export const valueEntryMethod = ["manual", "calculated"] as const;
export const valueEntryMethodEnum = pgEnum(
  "value_entry_method",
  valueEntryMethod
);
export const valueMethod = ["manual", "calculated"] as const;
export const valueMethodEnum = pgEnum("value_method", valueMethod);

export const schedulePatternType = ["cron", "rrule"] as const;
export const schedulePatternTypeEnum = pgEnum(
  "schedule_pattern_type",
  schedulePatternType
);

export type SchedulePatternType = (typeof schedulePatternType)[number];

export type CronPattern = {
  type: Extract<SchedulePatternType, "cron">;
  expression: string; // e.g., "0 0 1 * *" for 1st of month
  timezone?: string;
};

export type RRulePattern = {
  type: Extract<SchedulePatternType, "rrule">;
  expression: string; // e.g., "FREQ=MONTHLY;BYDAY=2TU" for 2nd Tuesday
  timezone?: string;
};

export type SchedulePattern = CronPattern | RRulePattern;

export type AccountType = (typeof accountType)[number];
export type ContributionInterval = (typeof contributionInterval)[number];
export type ValueEntryMethod = (typeof valueEntryMethod)[number];
export type ValueMethod = (typeof valueMethod)[number];

export type AssetValueMetadataSecurity = {
  securityName: string;
  securitySymbol: string;
  value: number;
  shareHolding: number;
};

export type AssetValueMetadata = {
  calculatedAt: string;
  securitiesProcessed: number;
  securitiesTotal: number;
  dataStatus: "complete" | "partial";
  sourcesUsed: string[]; // Dynamic source identifiers from actual services
  securities: AssetValueMetadataSecurity[];
};

export const assetValues = pgTable("asset_values", {
  id: uuid("id")
    .notNull()
    .default(sql`gen_random_uuid()`),
  value: real("value").notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  valueDate: timestamp("value_date").notNull(),
  entryMethod: valueEntryMethodEnum("entry_method").notNull().default("manual"),
  assetId: uuid("asset_id").notNull(),
  metadata: jsonb("metadata").$type<AssetValueMetadata>(), // Detailed entry information and calculation breakdown
  ...timestampColumns(),
});

export type AssetValueSelect = InferSelectModel<typeof assetValues>;
export type AssetValueInsert = InferInsertModelBasic<typeof assetValues>;

// export const assetContributions = pgTable("asset_contributions", {
//   id: uuid('id').notNull().default(sql`gen_random_uuid()`),
//   value: real("value").notNull(),
//   recordedAt: timestamp("recorded_at").notNull(),
//   assetId: uuid("asset_id").notNull(),
//   ...timestampColumns()
// });

// export type AssetContributionSelect = InferSelectModel<typeof assetContributions>;
// export type AssetContributionInsert = InferInsertModelBasic<typeof assetContributions>;

// export const assetDebits = pgTable("asset_debits", {
//   id: uuid('id').notNull().default(sql`gen_random_uuid()`),
//   value: real("value").notNull(),
//   recordedAt: timestamp("recorded_at").notNull(),
//   assetId: uuid("asset_id").notNull(),
//   ...timestampColumns()
// });

// export type AssetDebitSelect = InferSelectModel<typeof assetDebits>;
// export type AssetDebitInsert = InferInsertModelBasic<typeof assetDebits>;

export const recurringContributions = pgTable("recurring_contributions", {
  id: uuid("id")
    .notNull()
    .default(sql`gen_random_uuid()`),
  assetId: uuid("asset_id").notNull(),
  amount: real("amount").notNull(),
  startDate: timestamp("start_date").notNull(),
  patternConfig: jsonb("pattern_config").$type<SchedulePattern>().notNull(),
  lastProcessedDate: timestamp("last_processed_date"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestampColumns(),
});

export type RecurringContributionSelect = InferSelectModel<
  typeof recurringContributions
>;
export type RecurringContributionInsert = InferInsertModelBasic<
  typeof recurringContributions
>;

// export const generalAssets = pgTable("general_assets", {
//   id: uuid('id').notNull().default(sql`gen_random_uuid()`),
//   assetType: text("asset_type").notNull().default("general"),
//   name: text("name").notNull().unique(),
//   currentValue: real("current_value").notNull().default(0),
//   userAccountId: uuid("user_account_id").notNull().references(() => userAccounts.id),
//   ...timestampColumns()
// }, (t) => [
//   //Ensure asset type is general
//   check("asset_type_check", sql`${t.assetType} = 'general'`)
// ]);

// export type GeneralAssetSelect = InferSelectModel<typeof generalAssets>;
// export type GeneralAssetInsert = InferInsertModelBasic<typeof generalAssets>;

export const brokerPlatforms = pgTable("broker_platforms", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  supportsAPIKey: boolean("supports_api_key").notNull().default(false),
  supportedAccountTypes: accountTypeEnum("supported_account_types")
    .array()
    .notNull(),
  ...timestampColumns(),
});

export type BrokerPlatformSelect = InferSelectModel<typeof brokerPlatforms>;
export type BrokerPlatformInsert = InferInsertModelBasic<
  typeof brokerPlatforms
>;

export const brokerProviders = pgTable("broker_providers", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  //slug: text("slug").notNull().unique().default(slugify("name")),
  supportsAPIKey: boolean("supports_api_key").notNull().default(false),
  supportedAccountTypes: accountTypeEnum("supported_account_types")
    .array()
    .notNull(),
  ...timestampColumns(),
});

export type BrokerProviderSelect = InferSelectModel<typeof brokerProviders>;
export type BrokerProviderInsert = InferInsertModelBasic<
  typeof brokerProviders
>;

export const userAssets = pgTable(
  "user_assets",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    startDate: timestamp("start_date").notNull(),
    valueMethod: valueMethodEnum("value_method")
      .notNull()
      .default("calculated"),
    currentValue: real("current_value").notNull().default(0),
    userAccountId: uuid("user_account_id")
      .notNull()
      .references(() => userAccounts.id),
    platformId: uuid("platform_id").references(() => brokerPlatforms.id),
    providerId: uuid("provider_id").references(() => brokerProviders.id),
    accountType: text("account_type").notNull(), // ISA, SIPP, LISA (Lifetime ISA), GIA (General Account)
    ...timestampColumns(),
  },
  (t) => [
    //Ensure asset type is broker
    //check("asset_type_check", sql`${t.assetType} = 'broker'`)
  ]
);

/**
 * This should only ever be used for manual transactions, not for calculated transactions.
 */
export const assetTransactions = pgTable(
  "asset_transactions",
  {
    id: uuid("id")
      .notNull()
      .default(sql`gen_random_uuid()`),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => userAssets.id, { onDelete: "cascade" }),
    value: real("value").notNull(),
    currencyValue: real("currency_value").notNull().default(0),
    fees: real("fees").notNull().default(0),
    //TODO
    //The currency information will need to be added and not optional with default value eventually
    currency: text("currency").notNull().default("GBP"),
    valueDate: timestamp("value_date").notNull(),
    recordedAt: timestamp("recorded_at").notNull(),
    ...timestampColumns(),
  },
  (table) => [index("asset_transactions_value_date_idx").on(table.valueDate)]
);

export type AssetTransactionSelect = InferSelectModel<typeof assetTransactions>;
export type AssetTransactionInsert = InferInsertModelBasic<
  typeof assetTransactions
>;

export type UserAssetSelect = InferSelectModel<typeof userAssets>;
export type UserAssetInsert = InferInsertModelBasic<typeof userAssets>;

export const userAssetSecurities = pgTable("user_asset_securities", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAssetId: uuid("user_asset_id")
    .notNull()
    .references(() => userAssets.id, { onDelete: "cascade" }),
  securityId: uuid("security_id")
    .notNull()
    .references(() => securities.id),
  //shareHolding: real("share_holding").notNull(),
  archived: boolean("archived").notNull().default(false),
  priorGainLoss: real("prior_gain_loss").notNull(),
  startDate: timestamp("start_date").notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  ...timestampColumns(),
});

export const securityTransactions = pgTable(
  "security_transactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    assetSecurityId: uuid("asset_security_id")
      .notNull()
      .references(() => userAssetSecurities.id, { onDelete: "cascade" }),
    value: real("value").notNull(), //The number of shares held
    //TODO
    //We should have this but when user is adding there account they might not know the currency value.
    //Do we force the user to add the currency value? or do we obtain the currency value from the
    //cache or api?
    //currencyValue: real("currency_value").notNull().default(0),
    currencyValue: real("currency_value").notNull(),
    fees: real("fees").default(0),
    //TODO
    //The currency information will need to be added and not optional with default value eventually
    currency: text("currency").notNull().default("GBP"),
    valueDate: timestamp("value_date").notNull(),
    recordedAt: timestamp("recorded_at").notNull(),
    ...timestampColumns(),
  },
  (table) => [
    index("security_transactions_asset_security_id_idx").on(
      table.assetSecurityId
    ),
    index("security_transactions_value_date_idx").on(table.valueDate),
    index("security_transactions_recorded_at_idx").on(table.valueDate),
  ]
);

export type SecurityTransactionSelect = InferSelectModel<
  typeof securityTransactions
>;
export type SecurityTransactionInsert = InferInsertModelBasic<
  typeof securityTransactions
>;

export const securityTransactionRelations = relations(
  securityTransactions,
  ({ one }) => ({
    assetSecurity: one(userAssetSecurities, {
      fields: [securityTransactions.assetSecurityId],
      references: [userAssetSecurities.id],
    }),
  })
);

/**
 * TODO we need to have a intermediate state where the user confirms
 * that the contrbution has been applied, the quanity of shares and currency value is correct.
 */
// export const securityRecurringContributions = pgTable(
//   "security_recurring_contributions",
//   {
//     id: uuid("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     securityId: uuid("security_id")
//       .notNull()
//       .references(() => userAssetSecurities.id, { onDelete: "cascade" }),
//     amount: real("amount").notNull(),
//     startDate: timestamp("start_date").notNull(),
//     pattern: jsonb("pattern").$type<SchedulePattern>(),
//     lastProcessedDate: timestamp("last_processed_date"),
//     isActive: boolean("is_active").notNull().default(true),
//     ...timestampColumns(),
//   }
// );

export const userAssetAPIKeyConnections = pgTable(
  "user_asset_api_key_connections",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userAssetId: uuid("user_asset_id")
      .notNull()
      .references(() => userAssets.id),
    apiKey: text("api_key").notNull(),
    ...timestampColumns(),
  }
);

export const userAssetsRelations = relations(userAssets, ({ one, many }) => ({
  provider: one(brokerProviders, {
    fields: [userAssets.providerId],
    references: [brokerProviders.id],
  }),
  platform: one(brokerPlatforms, {
    fields: [userAssets.platformId],
    references: [brokerPlatforms.id],
  }),
  apiKeyConnections: one(userAssetAPIKeyConnections),
  recurringContributions: many(recurringContributions),
  securities: many(userAssetSecurities),
}));

// Securities relations defined here to avoid circular imports
export const securitiesRelations = relations(securities, ({ many }) => ({
  userAssetSecurities: many(userAssetSecurities),
  dailyHistory: many(securityDailyHistory),
}));

export const userAssetSecuritiesRelations = relations(
  userAssetSecurities,
  ({ one }) => ({
    userAsset: one(userAssets, {
      fields: [userAssetSecurities.userAssetId],
      references: [userAssets.id],
    }),
    security: one(securities, {
      fields: [userAssetSecurities.securityId],
      references: [securities.id],
    }),
  })
);

export const recurringContributionsRelations = relations(
  recurringContributions,
  ({ one }) => ({
    asset: one(userAssets, {
      fields: [recurringContributions.assetId],
      references: [userAssets.id],
    }),
  })
);

export type UserAssetAPIKeyConnectionSelect = InferSelectModel<
  typeof userAssetAPIKeyConnections
>;
export type UserAssetAPIKeyConnectionInsert = InferInsertModelBasic<
  typeof userAssetAPIKeyConnections
>;

export type UserAssetSecuritySelect = InferSelectModel<
  typeof userAssetSecurities
>;
export type UserAssetSecurityInsert = InferInsertModelBasic<
  typeof userAssetSecurities
>;

export type UserAssetWith<
  W extends IncludeRelation<"userAssets"> | undefined = undefined
> = InferResultType<"userAssets", W>;
