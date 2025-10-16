import { assetValues } from "@server/db/schema";
import { Database } from "@server/db";
import { userAssets } from "@server/db/schema";
import { eq, getTableColumns, sql } from "drizzle-orm";

export const assetsQueryBuilder = (db: Database) =>
  db
    .select({
      ...getTableColumns(userAssets),
      currentValue: sql<number>`COALESCE(latest_value.value, 0)`,
      lastValueDate: sql<Date | null>`latest_value.value_date`,
    })
    .from(userAssets)
    .leftJoin(
      sql`LATERAL (
                  SELECT ${assetValues.value}, ${assetValues.valueDate}
                  FROM ${assetValues}
                  WHERE ${assetValues.assetId} = ${userAssets.id}
                  ORDER BY ${assetValues.valueDate} DESC
                  LIMIT 1
                ) AS latest_value`,
      sql`true`
    );
