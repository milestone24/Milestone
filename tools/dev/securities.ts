import { factory } from "@server/services/securities"

import { db } from "@server/db"

const securityService = factory()

import dotenv from "dotenv"
import { brokerProvideraAssetSecurities } from "@server/db/schema"
import { eq } from "drizzle-orm"

dotenv.config({
  path: "./.local.env",
})

console.log("EODHD_API_KEY", process.env.EODHD_API_KEY)

const go = async () => {

  const assetSecurities = await db.query.brokerProvideraAssetSecurities.findFirst({
    where: eq(brokerProvideraAssetSecurities.brokerProviderAssetId, "f9348e7c-e5f9-4587-8587-544a62a561f3"),
    with: {
      security: true
    }
  })

  console.log("ASSET SECURITIES", assetSecurities)

  if(!assetSecurities) {
    console.log("NO ASSET SECURITIES FOUND")
    return
  }

  if(!assetSecurities.security?.isin) {
    console.log("NO ISIN FOUND")
    return
  }

  //const securities = await securityService.findSecurities(["AAPL"])

  const startDate = new Date("2024-07-01")
  const endDate = new Date("2025-08-01")

  // const history = await securityService.getSecurityHistoryForDateRange(
  //   { symbol: assetSecurities.security.symbol, exchange: assetSecurities.security.exchange || undefined }, startDate, endDate)
  // console.log("HISTORY", history)

  const history = await securityService.getSecurityHistoryLiveForDateRange(
    { symbol: assetSecurities.security.symbol, exchange: assetSecurities.security.exchange || undefined }, startDate, endDate)
  console.log("HISTORY", history)

  //const history = await securityService.getCalculatedSecurityHistoryForDateRange("AAPL", 100, startDate, endDate)
  //console.log("HISTORY", history.length)

  //const intradayHistory = await securityService.getIntradaySecurityHistoryForDate({ symbol: "AAPL", exchange: "US" }, new Date("2025-08-07"))

  //console.log("HISTORY", intradayHistory.length)
}

go()
