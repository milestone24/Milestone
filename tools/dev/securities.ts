import { factory } from "@server/services/securities"

import { db } from "@server/db"

const securityService = factory()

import dotenv from "dotenv"
import { userAssetSecurities } from "@server/db/schema";
import { eq } from "drizzle-orm"

import { populateSecuritiesDailyHistoryCache } from "@server/services/securities/sync/cache";

import { factory as assetValueFactory } from "@server/services/securities/sync/asset-value";

import {
  assetPersistenceFactory,
  DatabaseAssetService,
} from "@server/services/assets/database";
import { createDecimalValueString } from "@shared/schema";

const assetService = new DatabaseAssetService(db);
const { calculateAssetValueForDateFromCache, updateAssetValues } =
  assetValueFactory();

dotenv.config({
  path: "./.local.env",
});

console.log("EODHD_API_KEY", process.env.EODHD_API_KEY);

const go = async () => {
  const assetId = "f9348e7c-e5f9-4587-8587-544a62a561f3";

  const assetSecurities = await db.query.userAssetSecurities.findFirst({
    where: eq(userAssetSecurities.userAssetId, assetId),
    with: {
      security: true,
    },
  });

  //insert a value for the asset as start point
  const assetValue = await assetService.createUserAssetValueHistory(assetId, {
    value: createDecimalValueString("0"),
    recordedAt: new Date("2025-0-01"),
    valueDate: new Date("2025-0-01"),
    //entryMethod: "calculated",
    // metadata: {
    //   calculatedAt: new Date().toISOString()
    // }
  });

  //process.exit(0)

  console.log("ASSET SECURITIES", assetSecurities);

  if (!assetSecurities) {
    console.log("NO ASSET SECURITIES FOUND");
    return;
  }

  // if(!assetSecurities.security?.isin) {
  //   console.log("NO ISIN FOUND")
  //   return
  // }

  //const securities = await securityService.findSecurities(["AAPL"])

  const startDate = new Date("2024-07-01");
  const endDate = new Date("2025-08-01");

  // const history = await securityService.getSecurityHistoryForDateRange(
  //   { symbol: assetSecurities.security.symbol, exchange: assetSecurities.security.exchange || undefined }, startDate, endDate)
  // console.log("HISTORY", history)

  // const history = await securityService.getSecurityHistoryLiveForDateRange(
  //   { symbol: assetSecurities.security.symbol, exchange: assetSecurities.security.exchange || undefined }, startDate, endDate)
  // console.log("HISTORY", history)

  //const history = await securityService.getCalculatedSecurityHistoryForDateRange("AAPL", 100, startDate, endDate)
  //console.log("HISTORY", history.length)

  //const intradayHistory = await securityService.getIntradaySecurityHistoryForDate({ symbol: "AAPL", exchange: "US" }, new Date("2025-08-07"))

  //console.log("HISTORY", intradayHistory.length)

  const securityContexts = [
    {
      securityId: assetSecurities.securityId,
      //startDate: assetSecurities.startDate
      startDate: new Date("2022-10-01"),
    },
  ];

  // const results = await calculateAssetValueForDateFromCache([{
  //   securityId: assetSecurities.securityId,
  //   symbol: assetSecurities.security.symbol,
  //   exchange: assetSecurities.security.exchange || undefined,
  //   shareHolding: assetSecurities.shareHolding
  // }], new Date("2025-08-01"))

  //const results = await populateSecuritiesDailyHistoryCache(securityContexts)

  const results = await updateAssetValues(
    assetPersistenceFactory(assetService, assetId)
  );

  console.log("RESULTS", results);
};

go()
