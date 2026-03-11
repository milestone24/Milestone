import {
  assetValues,
  DecimalValueString,
  recurringContributions,
  securityTransactions,
  userAssetSecurities,
} from "@server/db/schema";
import { Database } from "@server/db";
import { brokerPlatforms, userAssets } from "@server/db/schema";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { TransactionType, ValueAbstractType } from "@shared/schema";

const lateralLatestValueSql = sql`LATERAL (
                  SELECT ${assetValues.value}, ${assetValues.valueDate}
                  FROM ${assetValues}
                  WHERE ${assetValues.assetId} = ${userAssets.id}
                  ORDER BY ${assetValues.valueDate} DESC
                  LIMIT 1
                ) AS latest_value`;

export const calculatedAssetsQueryBuilder = (db: Database) =>
  db
    .select({
      ...getTableColumns(userAssets),
      currentValue: sql<DecimalValueString>`cast(COALESCE(latest_value.value, 0) as decimal(18, 2))`,
      lastValueDate: sql<Date | null>`latest_value.value_date`,
    })
    .from(userAssets)
    .leftJoin(lateralLatestValueSql, sql`true`);

export const calculatedAssetsWithContributionsQueryBuilder = (db: Database) =>
  db
    .select({
      asset: {
        ...getTableColumns(userAssets),
        currentValue: sql<DecimalValueString>`cast(COALESCE(latest_value.value, 0) as decimal(18, 2))`,
        lastValueDate: sql<Date | null>`latest_value.value_date`,
        platformName: brokerPlatforms.name,
      },
      recurringContribution: recurringContributions,
    })
    .from(userAssets)
    .leftJoin(lateralLatestValueSql, sql`true`)
    .leftJoin(brokerPlatforms, eq(userAssets.platformId, brokerPlatforms.id))
    .leftJoin(
      recurringContributions,
      sql`${userAssets.id} = ${recurringContributions.assetId}`
    );

export const securityTransactionsAccumulatedCTEBuilder = (
  db: Database,
) => db.$with("securityTransactionsAccumulated").as((qb) =>
      qb
        .select({
          ...getTableColumns(securityTransactions),
          //We can not use this it must be the asset id
          //not the asset function parameter because we are obtaining
          //all the securities for in this CTE for the sums.
          //and then the use of this CTE is filtered with WHERE clauses.
          //assetId: sql<string>`${assetId}`.as("assetId"),
          assetId: userAssetSecurities.userAssetId,
          assetSecurityId: securityTransactions.assetSecurityId,

          recordType: sql<
            Extract<ValueAbstractType, "transaction">
          >`'transaction'`.as("recordType"),
          transactionType: sql<TransactionType>`'security'`.as(
            "transactionType"
          ),
          value: securityTransactions.value,
          currencyValue: securityTransactions.currencyValue,
          accumalitiveSecurityValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.value}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`.as(
              "accumalitiveSecurityValue"
            ),
          accumulativeSecurityCurrencyValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`.as(
              "accumulativeSecurityCurrencyValue"
            ),
          accumulativeSecurityCurrencyValueRow:
            sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.id} ORDER BY ${securityTransactions.valueDate})`.as(
              "accumulativeSecurityCurrencyValueRow"
            ),
          accumulativeAssetCurrencyValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.userAssetId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`.as(
              "accumulativeAssetCurrencyValue"
            ),
          accumulativeAssetCurrencyValueRow:
            sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.userAssetId} ORDER BY ${securityTransactions.valueDate})`.as(
              "accumulativeAssetCurrencyValueRow"
            ),
        })
        .from(userAssetSecurities)
        .innerJoin(
          securityTransactions,
          eq(securityTransactions.assetSecurityId, userAssetSecurities.id)
        )
        .orderBy(
          asc(userAssetSecurities.userAssetId),
          asc(userAssetSecurities.id)
        )
    );
