import { DatabaseAssetService } from "./database";
import { DatabaseUserService } from "@server/services/users/database";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createDecimalValueString } from "@shared/schema/utils";
import { BrokerPlatform, UserAssetInsert } from "@shared/schema";
import { createRRulePattern } from "@shared/utils/scheduling";
import { subDays } from "date-fns";
import * as schema from "@server/db/schema";

import { drizzle } from "drizzle-orm/node-postgres";
import { setupOne } from "@server/test-utils/setup-one";
import { eq, sql } from "drizzle-orm";
import { db } from "@server/db";
import { AssetValuesService } from "../process/asset-values";
// const db = drizzle.mock({
//   schema,
// });

// beforeAll(async () => {
//   await setupOne({ db, schema });
// });

// afterAll(async () => {
//   await db.execute(sql`TRUNCATE TABLE * CASCADE`);
// });

// describe.only("setupOne", () => {
//   it("should setup one", async () => {
//     const userAccount = await db
//       .select()
//       .from(schema.userAccounts)
//       .where(eq(schema.userAccounts.email, "gary@milestone.com"));
//     expect(userAccount).toBeDefined();
//     expect(userAccount[0]?.email).toBe("gary@milestone.com");
//   });
// });

describe("DatabaseAssetService createUserAsset", () => {
  let databaseAssetService: DatabaseAssetService;
  let databaseUserService: DatabaseUserService;
  let assetValuesService: AssetValuesService;
  let platform: BrokerPlatform;
  let userAccountId: string;

  beforeAll(async () => {
    databaseAssetService = new DatabaseAssetService(db);
    databaseUserService = new DatabaseUserService(db);
    assetValuesService = new AssetValuesService(db);

    const platforms = await databaseAssetService.getBrokerPlatforms();
    if (!platforms || platforms.length === 0) {
      throw new Error("No broker platforms found");
    }
    platform = platforms[0]!;
    const userAccount = await databaseUserService.getUserAccountByEmail(
      "gary@milestone.com"
      //"chris@milestone.com"
    );

    if (!userAccount) {
      throw new Error("User account not found");
    }
    userAccountId = userAccount.id;
  });

  it(
    "should create a user asset",
    async () => {
      const updateAssetValuesSpy = await vi.spyOn(
        assetValuesService,
        "updateAssetValuesForAssetOfAccount"
      );
      // .mockImplementation(async () => {
      //   return Promise.resolve();
      // });

      const startDate = subDays(new Date(), 2);

      const data: UserAssetInsert = {
        name: "Test Asset",
        accountType: "ISA",
        platformId: platform.id,
        currentValue: createDecimalValueString("0"),
        valueMethod: "calculated",
        startDate,
        userAccountId,
        securities: [
          {
            type: "new",
            lid: "5d627060-d23a-448a-ad8d-e93292c0f3c5",
            security: {
              symbol: "APPS",
              name: "Digital Turbine Inc",
              sourceIdentifier: "eodhd",
              exchange: "US",
              country: "USA",
              currency: "USD",
              type: "Common Stock",
              isin: "US25400W1027",
              cusip: "0000000000",
              figi: "0000000000",
            },
            initialHolding: {
              shareHolding: createDecimalValueString("10000"),
              currencyValue: createDecimalValueString("100"),
            },
            startDate,
          },
        ],
        contributions: {
          amount: createDecimalValueString("200"),
          process: "manual",
          startDate,
          patternConfig: {
            type: "rrule",
            expression: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
            ).expression,
          },
          notificationEmail: false,
          notificationPush: false,
          isActive: true,
          type: "security",
          securityDistribution: [
            {
              securityId: "5d627060-d23a-448a-ad8d-e93292c0f3c5",
              isTempSecurityId: true,
              securityName: "Digital Turbine Inc",
              commitment: createDecimalValueString("100"),
            },
          ],
        },
      };

      const asset = await databaseAssetService.createUserAsset(data);

      expect(asset).toBeDefined();
      expect(updateAssetValuesSpy).toHaveBeenCalledWith(
        data.userAccountId,
        asset.id
      );
    },
    60000 * 10
  );
});
