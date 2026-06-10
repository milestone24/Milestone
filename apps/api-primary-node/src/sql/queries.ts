import { db } from "@/db";
import { assetValues } from "@/db/schema";
import { sql } from "drizzle-orm";

export const assetValuesSwap = async (stagedTableName: string) => {
  await db.execute(sql`
    BEGIN;
-- Step 1: Lock the final table for brief period
LOCK TABLE ${assetValues} IN EXCLUSIVE MODE;

-- Step 2: Replace data using the result of the successful job
TRUNCATE ${assetValues};z
INSERT INTO ${assetValues} SELECT * FROM ${stagedTableName};

-- Optional: Clean up staging table
DROP TABLE ${stagedTableName};

-- Step 3: Commit the final update
COMMIT;
  `);
};
