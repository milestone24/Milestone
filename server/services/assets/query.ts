import {
  assetValues,
  DecimalValueString,
  recurringContributions,
} from "@server/db/schema";
import { Database } from "@server/db";
import { userAssets } from "@server/db/schema";
import { eq, getTableColumns, sql } from "drizzle-orm";

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
      },
      recurringContribution: recurringContributions,
    })
    .from(userAssets)
    .leftJoin(lateralLatestValueSql, sql`true`)
    .leftJoin(
      recurringContributions,
      sql`${userAssets.id} = ${recurringContributions.assetId}`
    );
