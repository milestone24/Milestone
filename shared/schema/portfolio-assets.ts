import { z, ZodType } from "zod";
import type {
  UserAssetInsert as DBUserAssetInsert,
  UserAssetSelect as DBUserAsset,
  AssetValueInsert as DBAssetValueInsert,
  AssetValueSelect as DBAssetValueSelect,
  UserAssetSecuritySelect as DBUserAssetSecurity,
  UserAssetSecurityInsert as DBUserAssetSecurityInsert,
  UserAssetAPIKeyConnectionSelect as DBUserAssetAPIKeyConnection,
  BrokerProviderSelect as DBBrokerProvider,
  BrokerPlatformSelect as DBBrokerPlatform,
  AccountType as DBAccountType,
  AssetValueMetadata as DBAssetValueMetadata,
  AssetValueMetadataSecurity as DBAssetValueMetadataSecurity,
} from "@server/db/schema/index";
import {
  accountType,
  accountTypeEnum,
  decimalValueSchema,
  decimalValueSchemaRequiredGreaterThanZero,
} from "@server/db/schema/index";
import {
  DecimalValueString,
  IfConstructorEquals,
  isDecimalValueString,
} from "./utils";
import {
  securityInsertSchema,
  SecuritySelect,
  securitySelectSchema,
} from "./securities";

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

export const userAssetSecurityBaseSchema = z.object({
  startDate: z.coerce.date(),
  priorGainLoss: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Prior gain/loss must be a valid decimal string",
    })
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  //TODO Remove this, this is backend only
  //recordedAt: z.coerce.date().optional(),
});

export type UserAssetSecurityBase = z.infer<typeof userAssetSecurityBaseSchema>;

export const userAssetSecurityInitialHoldingSchema = z.object({
  shareHolding: decimalValueSchemaRequiredGreaterThanZero.refine(
    isDecimalValueString,
    {
      message: "Share holding must be a valid decimal string",
    }
  ),
  currencyValue: decimalValueSchemaRequiredGreaterThanZero.refine(
    isDecimalValueString,
    {
      message: "Currency value must be a valid decimal string",
    }
  ),
});

export type UserAssetSecurityInitialHolding = z.infer<
  typeof userAssetSecurityInitialHoldingSchema
>;

export const userAssetSecurityOrphanLinkInsertSchema =
  userAssetSecurityBaseSchema.extend({
    type: z.literal("link"),
    securityId: z.string(),
  });

export type UserAssetSecurityOrphanLinkInsert = z.infer<
  typeof userAssetSecurityOrphanLinkInsertSchema
>;

export const userAssetSecurityOrphanNewInsertSchema =
  userAssetSecurityBaseSchema.extend({
    type: z.literal("new"),
    security: securityInsertSchema
      .required()
      .refine((val) => val !== null && val !== undefined, {
        message: "Security is required",
      }),
  });

export type UserAssetSecurityOrphanNewInsert = z.infer<
  typeof userAssetSecurityOrphanNewInsertSchema
>;

export const userAssetSecurityOrphanNewCreateInsertSchema =
  userAssetSecurityOrphanNewInsertSchema.extend({
    initialHolding: userAssetSecurityInitialHoldingSchema,
  });

export type UserAssetSecurityOrphanNewCreateInsert = z.infer<
  typeof userAssetSecurityOrphanNewCreateInsertSchema
>;

export const userAssetSecurityOrphanLinkCreateInsertSchema =
  userAssetSecurityOrphanLinkInsertSchema.extend({
    initialHolding: userAssetSecurityInitialHoldingSchema,
  });

export type UserAssetSecurityOrphanLinkCreateInsert = z.infer<
  typeof userAssetSecurityOrphanLinkCreateInsertSchema
>;

export const userAssetSecurityOrphanCreateSchema = z.discriminatedUnion(
  "type",
  [
    userAssetSecurityOrphanNewCreateInsertSchema,
    userAssetSecurityOrphanLinkCreateInsertSchema,
  ]
);

export type UserAssetSecurityOrphanCreate = z.infer<
  typeof userAssetSecurityOrphanCreateSchema
>;

export const userAssetSecurityLinkInsertSchema =
  userAssetSecurityBaseSchema.extend({
    userAssetId: z.string(),
    securityId: z.string(),
  });

export type UserAssetSecurityLinkInsert = z.infer<
  typeof userAssetSecurityLinkInsertSchema
>;

// export const userAssetSecurityNewInsertSchema =
//   userAssetSecurityBaseSchema.extend({
//     userAssetId: z.string(),
//     security: securityInsertSchema
//       .required()
//       .refine((val) => val !== null && val !== undefined, {
//         message: "Security is required",
//       }),
//     /**
//      * Share holding and teh currency Value will be used to record an initial transaction.
//      */
//     shareHolding: decimalValueSchemaRequiredGreaterThanZero.refine(
//       isDecimalValueString,
//       {
//         message: "Share holding must be a valid decimal string",
//       }
//     ),
//     currencyValue: decimalValueSchemaRequiredGreaterThanZero.refine(
//       isDecimalValueString,
//       {
//         message: "Currency value must be a valid decimal string",
//       }
//     ),
//   });

// export type UserAssetSecurityNewInsert = z.infer<
//   typeof userAssetSecurityNewInsertSchema
// >;

// export const userAssetSecurityInsertSchema = z.discriminatedUnion("type", [
//   userAssetSecurityLinkInsertSchema.extend({
//     type: z.literal("link"),
//   }),
//   userAssetSecurityNewInsertSchema.extend({
//     type: z.literal("new"),
//   }),
// ]);

// export type UserAssetSecurityInsert = z.infer<
//   typeof userAssetSecurityInsertSchema
// >;

// export type UserAssetSecurityInsertLink = Omit<
//   Extract<UserAssetSecurityInsert, { type: "link" }>,
//   "type"
// >;
// export type UserAssetSecurityInsertNew = Omit<
//   Extract<UserAssetSecurityInsert, { type: "new" }>,
//   "type"
// >;

//export const userAssetSecurityInsertSchema

// export type UserAssetSecurityInsert = z.input<
//   typeof userAssetSecurityInsertSchema
// >;

/**
 * This is only for the use in the schema for the user asset orphan insert.
 * The shareholding and currency value will be translated to an initial transaction.
 * lid is a temporary id for the security, it is used to identify the security
 * primarily for recurring contribution mappings.
 */
// export const userAssetOrphanSecurityInsertSchema = userAssetSecurityBaseSchema.extend({
//   lid: z.string(),
//   security: securityInsertSchema,
//   shareHolding: decimalValueSchemaRequiredGreaterThanZero.refine(
//     isDecimalValueString,
//     {
//       message: "Share holding must be a valid decimal string",
//     }
//   ),
//   currencyValue: decimalValueSchemaRequiredGreaterThanZero.refine(
//     isDecimalValueString,
//     {
//       message: "Currency value must be a valid decimal string",
//     }
//   ),
// });

// export type UserAssetOrphanSecurityInsert = z.infer<
//   typeof userAssetOrphanSecurityInsertSchema
// >;

/**
 * This is used only when an initial security is added to an asset,
 * either via the create asset (account)
 * The shareholding and currency value will be translated to an initial transaction.
 * lid is a temporary id for the security, it is used to identify the security
 * primarily for recurring contribution mappings.
 */
// export const userAssetSecurityWithInitialValuesInsertSchema =
//   userAssetSecurityBaseSchema.extend({
//     //tid needs removing, this is not a responsibility here, only when the security is in a security group.
//     //tid: z.string(), //Temporary Id so the new asset security can be identified within a group.
//     security: securityInsertSchema
//       .required()
//       .refine((val) => val !== null && val !== undefined, {
//         message: "Security is required",
//       }),
//     /**
//      * Share holding and teh currency Value will be used to record an initial transaction.
//      */
//     shareHolding: decimalValueSchemaRequiredGreaterThanZero.refine(
//       isDecimalValueString,
//       {
//         message: "Share holding must be a valid decimal string",
//       }
//     ),
//     currencyValue: decimalValueSchemaRequiredGreaterThanZero.refine(
//       isDecimalValueString,
//       {
//         message: "Currency value must be a valid decimal string",
//       }
//     ),
//   });

// export type UserAssetSecurityWithInitialValuesInsert = z.infer<
//   typeof userAssetSecurityWithInitialValuesInsertSchema
// >;

export const userAssetOrphanInsertSchema = z.object({
  name: z
    .string()
    .min(4, { message: "Name must be at least 4 characters long" }),
  platformId: z.string().optional(),
  providerId: z.string().optional(),
  accountType: z.enum(accountType),
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
  securities: z.array(
    userAssetSecurityOrphanNewCreateInsertSchema.extend({ lid: z.string() })
  ),
  //Contibutions here should be in unison with the recurringContributionOrphanInsertSchema and recurringContributionInsertSchema
  contributions: recurringContributionGroupInsertSchema.optional(),
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

userAssetOrphanInsertSchema satisfies ZodType<
  Omit<DBUserAssetInsert, "userAccountId">
>;

export type UserAssetOrphanInsert = z.infer<typeof userAssetOrphanInsertSchema>;

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

export type ValueFields = {
  lastValueDate: Date | null;
  currentValue: DecimalValueString;
};

export type UserAssetWithValue = UserAsset & ValueFields;

export type ResolvedUserAsset = WithPlatform<
  WithResolvedSecurities<UserAssetWithValue>
>;

export type AssetValue = Omit<DBAssetValueSelect, "value"> & {
  value: DecimalValueString;
};

export type AssetValueMetadata = DBAssetValueMetadata;
export type AssetValueMetadataSecurity = DBAssetValueMetadataSecurity;

// export type UserAsset = Omit<DBUserAsset, "accountType"> & {
//   accountType: AccountType;
// };

// export type AssetValueMetadataSecurity = {
//   securityName: string;
//   securitySymbol: string;
//   value: DecimalValueString;
//   shareHolding: number;
// };

export const userAssetWithValueSchema = z.object({
  id: z.string(),
  name: z.string(),
  platformId: z.string().nullable(),
  providerId: z.string().nullable(),
  accountType: z.enum(accountType),
  startDate: z.coerce.date(),
  valueMethod: z.enum(["manual", "calculated"]),
  userAccountId: z.string(),
  updatedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().nullable(),
  lastValueDate: z.coerce.date().nullable(),
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
});

userAssetWithValueSchema._output satisfies UserAssetWithValue;

export const assetValueMetadataSecuritySchema = z.object({
  securityName: z.string(),
  securitySymbol: z.string(),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  shareHolding: decimalValueSchema.refine(isDecimalValueString, {
    message: "Share holding must be a valid decimal string",
  }),
});

assetValueMetadataSecuritySchema._output satisfies AssetValueMetadataSecurity;

// export type AssetValueMetadata = {
//   calculatedAt: string;
//   securitiesProcessed: number;
//   securitiesTotal: number;
//   dataStatus: "complete" | "partial";
//   sourcesUsed: string[]; // Dynamic source identifiers from actual services
//   securities: AssetValueMetadataSecurity[];
// };

export const assetValueMetadataSchema = z.object({
  calculatedAt: z.string(),
  securitiesProcessed: z.number(),
  securitiesTotal: z.number(),
  dataStatus: z.enum(["complete", "partial"]),
  sourcesUsed: z.array(z.string()),
  securities: z.array(assetValueMetadataSecuritySchema),
});

assetValueMetadataSchema._output satisfies AssetValueMetadata;

export const assetValueHistorySchema = z.object({
  id: z.string(),
  valueDate: z.coerce.date(),
  entryMethod: z.enum(["manual", "calculated"]),
  assetId: z.string(),
  metadata: assetValueMetadataSchema.nullable(),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  recordedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

assetValueHistorySchema._output satisfies AssetValue;

export const calculatedValueSchema = z.object({
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  currentChange: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current change must be a valid decimal string",
  }),
  currentChangePercentage: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current change percentage must be a valid decimal string",
  }),
});

export type CalculatedValue = z.infer<typeof calculatedValueSchema>;

export const assetsChangeSchema = calculatedValueSchema.extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Start value must be a valid decimal string",
  }),
});

export const userAssetWithValueChangeSchema = userAssetWithValueSchema.extend({
  accountChange: assetsChangeSchema,
});

userAssetWithValueChangeSchema._output satisfies UserAssetWithValueChange;

export type UserAssetWithValueChange = WithAccountChange<UserAssetWithValue>;

export const userAssetWithHistoryAndAccountChangeSchema =
  userAssetWithValueSchema.extend({
    history: z.array(assetValueHistorySchema),
    accountChange: assetsChangeSchema,
  });

export type UserAssetWithHistoryAndAccountChange = WithAccountChange<
  WithAssetHistory<UserAssetWithValue, AssetValue>
>;

userAssetWithHistoryAndAccountChangeSchema._output satisfies UserAssetWithHistoryAndAccountChange;

export const userAssetsWithHistoryAndAccountChangeSchema =
  userAssetWithHistoryAndAccountChangeSchema.array();

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

export type UserAssetAPIKeyConnection = DBUserAssetAPIKeyConnection;

export type BrokerPlatform = DBBrokerPlatform;

export type BrokerProvider = DBBrokerProvider;

export type UserAssetSecuritySelect = DBUserAssetSecurity & {
  security: SecuritySelect;
};

// export type CalculatedValue = {
//   value: DecimalValueString;
//   currentChange: DecimalValueString;
//   currentChangePercentage: DecimalValueString;
// };

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
  securities: ResolvedAssetSecurity[];
};

export type ResolvedAssetSecurity =
  WithCalculatedValue<UserAssetSecuritySelect>;

/**
 * Used to parse and validate the response from the API for a resolved asset security
 */
export const resolvedAssetSecuritySchema = z.object({
  id: z.string(),
  updatedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  startDate: z.coerce.date(),
  userAssetId: z.string(),
  securityId: z.string(),
  archived: z.boolean(),
  priorGainLoss: decimalValueSchema.nullable(),
  calculatedValue: calculatedValueSchema,
  security: securitySelectSchema,
});

resolvedAssetSecuritySchema._output satisfies ResolvedAssetSecurity;

export const resolvedAssetSecuritiesSchema = z.array(
  resolvedAssetSecuritySchema
);


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


export type PortfolioValue = {
  value: DecimalValueString;
  returnValue: DecimalValueString;
};