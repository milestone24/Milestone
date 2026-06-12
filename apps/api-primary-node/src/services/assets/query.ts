import {
  assetTransactions,
  assetValues,
  DecimalValueString,
  recurringContributions,
  securityTransactions,
  userAssetSecurities,
} from "@/db/schema";
import { Database } from "@/db";
import { brokerPlatforms, userAssets } from "@/db/schema";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { TransactionType, ValueAbstractType } from "@shared/schema";

/** Omit `ledgerGroupId` from spread so SQL does not duplicate `ledger_group_id` with `groupId` alias. */
const {
  ledgerGroupId: securityTransactionLedgerGroupIdColumn,
  ...securityTransactionColumnsExcludingLedgerGroupId
} = getTableColumns(securityTransactions);

const {
  ledgerGroupId: assetTransactionLedgerGroupIdColumn,
  ...assetTransactionColumnsExcludingLedgerGroupId
} = getTableColumns(assetTransactions);

export {
  assetTransactionLedgerGroupIdColumn,
  assetTransactionColumnsExcludingLedgerGroupId,
  securityTransactionLedgerGroupIdColumn,
  securityTransactionColumnsExcludingLedgerGroupId,
};

const lateralLatestValueSql = sql`LATERAL (
                  SELECT ${assetValues.value}, ${assetValues.valueDate}
                  FROM ${assetValues}
                  WHERE ${assetValues.assetId} = ${userAssets.id}
                  ORDER BY ${assetValues.valueDate} DESC
                  LIMIT 1
                ) AS latest_value`;

/**
 * For `value_method = calculated`, total MV = latest priced securities from `asset_values` plus
 * cumulative `asset_transactions.currency_value` on or before that snapshot. If there is no
 * snapshot, cash is the sum of all `asset_transactions` (matches “no `latest`” in the lateral).
 * Manual assets: `asset_values` total only.
 */
const calculatedAssetCurrentValueSql = sql<DecimalValueString>`cast(
  CASE
    WHEN ${userAssets.valueMethod} = 'calculated' THEN
      COALESCE(latest_value.value, 0) + COALESCE((
        SELECT sum(${assetTransactions.currencyValue})
        FROM ${assetTransactions}
        WHERE ${assetTransactions.assetId} = ${userAssets.id}
          AND (
            latest_value.value_date IS NULL
            OR ${assetTransactions.valueDate} <= latest_value.value_date
          )
      ), 0)
    ELSE
      COALESCE(latest_value.value, 0)
  END
  AS decimal(18, 4))`;

export const calculatedAssetsQueryBuilder = (db: Database) =>
  db
    .select({
      ...getTableColumns(userAssets),
      currentValue: calculatedAssetCurrentValueSql,
      lastValueDate: sql<Date | null>`latest_value.value_date`,
    })
    .from(userAssets)
    .leftJoin(lateralLatestValueSql, sql`true`);

export const calculatedAssetsWithContributionsQueryBuilder = (db: Database) =>
  db
    .select({
      asset: {
        ...getTableColumns(userAssets),
        currentValue: calculatedAssetCurrentValueSql,
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
          ...securityTransactionColumnsExcludingLedgerGroupId,
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
            sql<DecimalValueString>`cast(sum(${securityTransactions.value}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 8))`.as(
              "accumalitiveSecurityValue"
            ),
          accumulativeSecurityCurrencyValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 4))`.as(
              "accumulativeSecurityCurrencyValue"
            ),
          accumulativeSecurityCurrencyValueRow:
            sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.id} ORDER BY ${securityTransactions.valueDate})`.as(
              "accumulativeSecurityCurrencyValueRow"
            ),
          accumulativeAssetCurrencyValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.userAssetId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 4))`.as(
              "accumulativeAssetCurrencyValue"
            ),
          accumulativeAssetCurrencyValueRow:
            sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.userAssetId} ORDER BY ${securityTransactions.valueDate})`.as(
              "accumulativeAssetCurrencyValueRow"
            ),
          groupId: securityTransactionLedgerGroupIdColumn,
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

/**
 * Windowed sums of `currency_value` per user asset (`assetId`), with `beforeRange` / `afterRange`
 * for the same date-boundary pattern as security transactions in the combined portfolio history.
 */
export const assetTransactionsAccumulatedCte = (
  db: Database,
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
) => {
  return db.$with("assetTransactionsAccumulated").as(
    db
      .select({
        ...assetTransactionColumnsExcludingLedgerGroupId,
        recordType: sql<
          Extract<ValueAbstractType, "transaction">
        >`'transaction'`.as("recordType"),
        transactionType: sql<TransactionType>`'asset'`.as("transactionType"),
        accumulativeAssetCurrencyValue: sql<DecimalValueString>`cast(sum(${assetTransactions.currencyValue}) over (partition by ${assetTransactions.assetId} order by ${assetTransactions.valueDate} rows unbounded preceding) as decimal(18, 4))`.as(
          "accumulativeAssetCurrencyValue"
        ),
        accumulativeAssetCurrencyValueRow: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${assetTransactions.assetId} ORDER BY ${assetTransactions.valueDate}, ${assetTransactions.id})`.as(
          "accumulativeAssetCurrencyValueRow"
        ),
        beforeRange: sql<boolean>`${assetTransactions.valueDate} < ${startDate}`.as(
          "inRange"
        ),
        afterRange: sql<boolean>`${assetTransactions.valueDate} > ${endDate}`.as(
          "afterRange"
        ),
        groupId: assetTransactionLedgerGroupIdColumn,
      })
      .from(assetTransactions)
  );
};
