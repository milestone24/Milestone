import { z, ZodType } from "zod";
import type {
  UserAssetInsert as DBUserAssetInsert,
  UserAssetSelect as DBUserAsset,
  AssetValueInsert as DBAssetValueInsert,
  AssetValueSelect as DBAssetValueSelect,
  UserAssetSecuritySelect as DBUserAssetSecurity,
  UserAssetAPIKeyConnectionSelect as DBUserAssetAPIKeyConnection,
  BrokerProviderSelect as DBBrokerProvider,
  BrokerPlatformSelect as DBBrokerPlatform,
  AccountType as DBAccountType,
  AssetValueMetadata as DBAssetValueMetadata,
  AssetValueMetadataSecurity as DBAssetValueMetadataSecurity,
} from "@server/db/schema/index";
import { accountType, decimalValueSchema } from "@server/db/schema/index";
import {
  DecimalValueString,
  IfConstructorEquals,
  isDecimalValueString,
} from "./utils";
import { securityInsertSchema, SecuritySelect } from "./securities";

import {
  BrandedAbstractTransactionValue,
  patternSchema,
  recurringContributionGroupInsertSchema,
  recurringContributionOrphanInsertSchema,
  TransactionAbstract,
} from "./transaction";
import { BrandedValue, ValueAbstract, ValueAbstractType } from "./common";

export { accountType } from "@server/db/schema/index";

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

export type BrandedAssetValue = BrandedValue<
  AssetValue,
  Extract<ValueAbstractType, "asset_value">
>;

//export { accountType } from "@server/db/schema";

export const userAssetSecurityInsertSchema = z.object({
  tempId: z.string(),
  security: securityInsertSchema,
  shareHolding: decimalValueSchema.refine(isDecimalValueString, {
    message: "Share holding must be a valid decimal string",
  }),
  currencyValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Currency value must be a valid decimal string",
  }),
  startDate: z.coerce.date(),
  priorGainLoss: decimalValueSchema.refine(isDecimalValueString, {
    message: "Prior gain/loss must be a valid decimal string",
  }),
  recordedAt: z.coerce.date().optional(),
});

export type UserAssetSecurityInsert = z.infer<
  typeof userAssetSecurityInsertSchema
>;

export const userAssetOrphanInsertSchema = z.object({
  name: z
    .string()
    .min(4, { message: "Name must be at least 4 characters long" }),
  platformId: z.string().optional(),
  providerId: z.string().optional(),

  //TODO Account type to become a wrapper type
  //wrapperType: z.string().optional(),
  accountType: z
    .string()
    .refine((val) => Object.values(accountType).includes(val as AccountType)),

  startDate: z.coerce
    .date()
    .refine((val) => val <= new Date(), {
      message: "Start date must be in the past",
    })
    .refine((val) => val >= new Date("2000-01-01"), {
      message: "Start date must be after 2000-01-01",
    }),
  valueMethod: z.enum(["manual", "calculated"]),

  //Only to be specified by user if the asset is to be manually updated
  currentValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Current value must be a valid decimal string",
    })
    .optional(),
  securities: z.array(userAssetSecurityInsertSchema),
  //Contibutions here should be in unison with the recurringContributionOrphanInsertSchema and recurringContributionInsertSchema
  contributions: recurringContributionGroupInsertSchema.optional(),
  // contributions: z
  //   .object({
  //     type: z.enum(["asset", "security"]),
  //     isScheduled: z.boolean(),
  //     process: z.enum(["automatic", "manual"]),
  //     amount: z.coerce.number(),
  //     startDate: z.coerce.date(),
  //     //date: z.coerce.date(),
  //     securityDistribution: z.array(
  //       z.object({
  //         securityTempId: z.string(),
  //         securityName: z.string(),
  //         commitment: z.number(),
  //       })
  //     ),
  //     patternConfig: patternSchema,
  //     // notificationPeriod: z.enum([
  //     //   "daily",
  //     //   "weekly",
  //     //   "monthly",
  //     //   "quarterly",
  //     //   "yearly",
  //     // ]),
  //     notificationEmail: z.boolean(),
  //     notificationPush: z.boolean(),
  //   })
  //   .optional(),
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
export type UserAssetWithHistoryAndAccountChange = WithAccountChange<
  WithAssetHistory<UserAssetWithValue, AssetValue>
>;

export type ValueFields = {
  lastValueDate: Date | null;
  currentValue: DecimalValueString;
};

export type UserAssetWithValue = UserAsset & ValueFields;

export type ResolvedUserAsset = WithPlatform<
  WithResolvedSecurities<UserAssetWithValue>
>;

export const userAssetValueOrphanInsertSchema = z.object({
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  recordedAt: z.coerce.date(),
  valueDate: z.coerce.date(),
});

userAssetValueOrphanInsertSchema._output satisfies Omit<
  DBAssetValueInsert,
  "assetId"
>;

export type UserAssetValueOrphanInsert = z.infer<
  typeof userAssetValueOrphanInsertSchema
>;

export const userAssetValueInsertSchema =
  userAssetValueOrphanInsertSchema.extend({
    assetId: z.string(),
  });

userAssetValueInsertSchema._output satisfies Omit<
  DBAssetValueInsert,
  "assetId"
>;

export type UserAssetValueInsert = z.infer<typeof userAssetValueInsertSchema>;

export type AssetValue = Omit<DBAssetValueSelect, "value"> & {
  value: DecimalValueString;
};

export type AssetValueMetadata = DBAssetValueMetadata;
export type AssetValueMetadataSecurity = DBAssetValueMetadataSecurity;

export type UserAssetAPIKeyConnection = DBUserAssetAPIKeyConnection;

export type BrokerPlatform = DBBrokerPlatform;

export type BrokerProvider = DBBrokerProvider;

export type UserAssetSecuritySelect = DBUserAssetSecurity & {
  security: SecuritySelect;
};

export type CalculatedValue = {
  value: DecimalValueString;
  currentChange: DecimalValueString;
  currentChangePercentage: DecimalValueString;
};

export type AssetsChange = CalculatedValue & {
  startDate: Date;
  endDate: Date;
  startValue: DecimalValueString;
};

export type WithCalculatedValue<T extends { id: string }> = T & {
  calculatedValue: CalculatedValue;
};

export type WithAccountChange<T extends { id: string }> = T & {
  accountChange: AssetsChange;
};

export type WithAssetHistory<
  T extends { id: string },
  H extends ValueAbstract
> = T & {
  //Change to ValueAbstract
  history: H[];
  //history: AssetValue[];
};

export type WithValueHistory<T extends { id: string }> = T & {
  history: AssetHistoryValue[];
};

export type AssetWithAssetValueHistory = WithAssetHistory<
  Pick<UserAsset, "id" | "valueMethod">,
  BrandedAssetValue
>;

export type AssetWithValueHistory = WithValueHistory<
  Pick<UserAsset, "id" | "valueMethod">
>;

export type WithSecurity<T extends { id: string }> = T & {
  security: SecuritySelect;
};

export type WithSecurities<T extends { id: string }> = T & {
  securities: WithSecurity<UserAssetSecuritySelect>[];
};

export type WithResolvedSecurities<T extends { id: string }> = T & {
  securities: ResolvedSecurity[];
};

export type ResolvedSecurity = WithSecurity<
  WithCalculatedValue<UserAssetSecuritySelect>
>;

export type WithPlatform<T extends { id: string }> = T & {
  platform?: BrokerPlatform;
};

/**
 * This is used when a dummy asset value is needed for a date range that is before the first asset value
 * or after the last asset value.
 * This is the case when the start point or endpoint of a date range does not have any values to calculate
 * and the value would normally be zero
 * - synthetic-asset is used for transactions that are synthetic but are based on real asset history items
 * - asset is used for asset history that are real asset items
 * - synthetic is used for purely synthetic time values (normally with a value of 0)
 */

export type AseetHistoryEntryType = "synthetic" | "synthetic-asset" | "asset";

export type AssetHistoryValueBase = {
  valueDate: Date;
  value: DecimalValueString;
  assetId: string;
  id: string;
};

export type PossibleDummyHistoryValue<T extends AssetHistoryValueBase> =
  | ({
      valueType: Extract<AseetHistoryEntryType, "synthetic">;
      valueDate: Date;
      value: DecimalValueString;
      id: null;
      assetId: null;
    } & Partial<Omit<T, "assetId" | "id" | "valueDate" | "value">>)
  | ({
      valueType: Extract<AseetHistoryEntryType, "synthetic-asset">;
      valueDate: Date;
      value: DecimalValueString;
      id: null;
      assetId: string;
    } & Omit<T, "assetId" | "id" | "valueDate" | "value">)
  | ({
      valueType: Extract<AseetHistoryEntryType, "asset">;
    } & T);

export type PossibleDummyAssetValue = PossibleDummyHistoryValue<
  Omit<AssetValue, "recordedAt">
>;

export type PossibleDummyAssetTransactionValue =
  PossibleDummyHistoryValue<TransactionAbstract>;

export type ResolvedAssetValue = AssetValue & {
  securities: UserAssetSecuritySelect[];
};

export type DataRangeQuery = {
  start: Date | string | null;
  end: Date | string | null;
};

export type AssetHistoryPoint = {
  id: string;
  type: "value" | "transaction";
  value: DecimalValueString;
  valueDate: Date;
  //recordedAt: Date;
};

export type SecurityHistoryPoint = {
  id: string;
  quantity: number;
  value: DecimalValueString;
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
  history: Iterator<BrandedAssetValue>;
};

export type AssetWithValueHistoryAsyncIterators = {
  id: string;
  history: AsyncIterator<BrandedAssetValue>;
};

export type AssetWithValueHistoryGenerators = {
  id: string;
  history: Generator<BrandedAssetValue>;
};

export type CombinedDayValuesChange = {
  previousValue: DecimalValueString;
  newValue: DecimalValueString;
  change: DecimalValueString;
} & (
  | {
      assetId: string;
      valueType: Extract<AseetHistoryEntryType, "asset" | "synthetic-asset">;
    }
  | {
      assetId: null;
      valueType: Extract<AseetHistoryEntryType, "synthetic">;
    }
);

export type CombinedDayTimePointBase = ValueAbstract & {
  changes: CombinedDayValuesChange[];
};

export type CombinedDayTimePoint<T extends Record<string, unknown>> =
  CombinedDayTimePointBase & T;

export type TransactionTimePoint = CombinedDayTimePoint<{
  transactions: PossibleDummyAssetTransactionValue[];
}>;

export type AssetValueTimePoint = CombinedDayTimePoint<{
  metadata: AssetValueMetadata[];
}>;

export type CombinedValueHistory = {
  transactions: TransactionTimePoint[];
  valueHistory: AssetValueTimePoint[];
};

export type AssetHistoryValue =
  | BrandedAbstractTransactionValue
  | BrandedAssetValue;
