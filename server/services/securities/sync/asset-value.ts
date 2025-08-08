// ============================================================================
// SECURITIES SYNC MODULE
// ============================================================================
// This module handles:
// 1. Security daily history cache population
// 2. Asset value calculation and creation
// 3. Real-time triggers and background sync operations

import { getSecurityHistoryForDateRange as getSecurityHistoryForDateRangeCache } from "../cache"
import { addDays } from "date-fns"
import { AssetSecurity, AssetValueResult } from "../types"
import type { AssetPersistence } from "@server/services/assets/database"
import { populateSecuritiesDailyHistoryCache, populateSecurityDailyHistoryCache } from "./cache"

// ============================================================================
// DAILY HISTORY CACHING METHODS
// ============================================================================

// Helper function for future use - currently unused
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const getMissingSecurityHistoryDates = (
//   existing: { date: Date }[],
//   startDate: Date,
//   endDate: Date
// ): Date[] => {
//   const existingDates = new Set(existing.map(record => record.date))
//   const missingDates: Date[] = []
//   const currentDate = new Date(startDate)
  
//   while (currentDate <= endDate) {
//     if (!existingDates.has(currentDate)) {
//       missingDates.push(new Date(currentDate))
//     }
//     currentDate.setDate(currentDate.getDate() + 1)
//   }
//   return missingDates
// }

// ============================================================================
// ASSET VALUE CALCULATION METHODS  
// ============================================================================

/**
 * Calculate asset value for a specific date using injected securities
 * This will always use the cache and so would always expect the cache to be populated
 */
const calculateAssetValueForDateFromCache = async (
  assetSecurities: AssetSecurity[],
  date: Date
): Promise<AssetValueResult | null> => {
  
  if (assetSecurities.length === 0) {
    return null
  }
  
  const securityHistory = await Promise.all(assetSecurities.map(async (security) => {
    const history = await getSecurityHistoryForDateRangeCache(security.securityId, date, date)
    return history.map(record => ({
      //TODO: close can not be null
      close: Number(record.close ?? 0),
      shareHolding: security.shareHolding,
      source: record.source
    }))
  }))

  return calculateAssetValue(date, securityHistory)
}

type SecurityHistoryForAssetCalculation = {
  close: number
  shareHolding: number
  source: string
}

const calculateAssetValue = async (
  historyDate: Date,
  securityHistory: SecurityHistoryForAssetCalculation[][]
): Promise<AssetValueResult | null> => {
  const calculationTimestamp = new Date().toISOString()
  let totalValue = 0
  let securitiesProcessed = 0
  const sourcesUsed = new Set<string>()

  for(const history of securityHistory) {
    for(const security of history) {
      totalValue += security.close * security.shareHolding
      securitiesProcessed++
      sourcesUsed.add(security.source)
    }
  }

  // Return null if no securities could be valued
  if (securitiesProcessed === 0) {
    return null
  }

  return {
    value: totalValue,
    entryMethod: 'calculated',
    valueDate: historyDate,
    metadata: {
      calculatedAt: calculationTimestamp,
      securitiesProcessed,
      securitiesTotal: securityHistory.length,
      dataStatus: securitiesProcessed === securityHistory.length ? 'complete' : 'partial',
      sourcesUsed: Array.from(sourcesUsed) // Dynamic source identifiers from actual services
    }
  }
}

// /**
//  * Calculate and create asset value records for a date range
//  * @param assetId - The broker provider asset ID  
//  * @param startDate - Start date for calculations
//  * @param endDate - End date for calculations
//  * @returns Promise with creation results
//  */
// export const populateAssetValuesForDateRange = async (
//   assetPersistence: AssetPersistence,
//   startDate: Date,
//   endDate: Date
// ): Promise<{
//   assetId: string;
//   dateRange: { start: Date; end: Date };
//   valuesCreated: number;
//   valuesSkipped: number; // Already exist
//   missingDates: Date[]; // No price data available
//   errors: Array<{
//     date: Date;
//     error: string;
//     securities?: string[]; // Which securities caused issues
//   }>;
// }> => {

//  //

//   // TODO: Implementation
//   throw new Error("Not implemented")
// }

const updateAssetValues = async (
  assetPersistence: AssetPersistence,
) => {

  const assetSecurities = await assetPersistence.getAssetSecurities()

  //TODO Consider if this should be done here.
  //Make sure this method is optimised to only retrieve the dates that are needed.
  const results = await populateSecuritiesDailyHistoryCache(assetSecurities.map(security => ({
    securityId: security.securityId,
    startDate: security.startDate,
    endDate: new Date()
  })))

  const earliestStartDate = assetSecurities.reduce((min, security) => {
    return security.startDate < min ? security.startDate : min
  }, new Date())

  //TODO Ensure cache is populated for all securities

  let currentDate = earliestStartDate
  const values: AssetValueResult[] = []

  console.log("STARTING ASSET VALUE CALCULATION", currentDate)

  const todayMinusOne = new Date();
  todayMinusOne.setDate(todayMinusOne.getDate() - 1);

  console.log("STARTING ASSET VALUE CALCULATION LOOP", currentDate, todayMinusOne)

  while(currentDate < todayMinusOne) {

    const assetValue = await calculateAssetValueForDateFromCache(assetSecurities, currentDate)

    //console.log("ASSET VALUE", assetValue)

    if(assetValue) {
      values.push(assetValue)
    } else {
      //TODO: Handle this
    }

    currentDate = addDays(currentDate, 1)
  }

  const lastValueDate = values.at(-1)?.valueDate

  const today = new Date()

  if(values.length > 0) {
    await assetPersistence.insertAssetValues(values.map(value => ({
      value: value.value,
      recordedAt: today,
      valueDate: value.valueDate,
      entryMethod: value.entryMethod,
      metadata: value.metadata
    })))
  } else {
    console.log("NO ASSET VALUES TO INSERT")
  }
  

}

/**
 * Triggered when user adds/modifies securities for an asset
 * Calculates current value and queues historical backfill
 * @param assetId - The broker provider asset ID
 * @param securitiesData - Array of security holdings data
 * @returns Promise with immediate calculation and backfill status
 */
// export const onSecuritiesUpsert = async (
//   assetId: string,
//   securitiesData: Array<{
//     securityId: string;
//     shareHolding: number;
//     recordedAt: Date;
//   }>
// ): Promise<{
//   currentValue: number;
//   metadata: Record<string, unknown>;
//   historicalBackfillNeeded: boolean;
//   backfillDateRange?: { start: Date; end: Date };
//   cacheStatus: {
//     pricesFromCache: number;
//     pricesFromAPI: number;
//     missingPrices: number;
//   };
// }> => {
//   const currentDate = new Date()
//   const cacheStatus = {
//     pricesFromCache: 0,
//     pricesFromAPI: 0,
//     missingPrices: 0
//   }

//   try {
//     // Step 1: Calculate current asset value immediately for UI feedback
//     const currentCalculation = await calculateAssetValueForDate(assetId, currentDate)
    
//     if (!currentCalculation) {
//       throw new Error("Unable to calculate current asset value")
//     }

//     // Step 2: Analyze cache status for the securities
//     const securityIds = securitiesData.map(s => s.securityId)
//     const todayStr = currentDate.toISOString().split('T')[0]
    
//     // Check which securities have price data for today
//     const todayPrices = await db.query.securityDailyHistory.findMany({
//       where: and(
//         sql`${securityDailyHistory.securityId} = ANY(${securityIds})`,
//         eq(securityDailyHistory.date, todayStr)
//       )
//     })

//     const securitiesWithTodayPrices = new Set(todayPrices.map(p => p.securityId))
    
//     // Count cache status
//     for (const securityId of securityIds) {
//       if (securitiesWithTodayPrices.has(securityId)) {
//         cacheStatus.pricesFromCache++
//       } else {
//         cacheStatus.missingPrices++
//       }
//     }

//     // Step 3: Determine if historical backfill is needed
//     // Check when this asset was created or when automation started
//     const asset = await db.query.brokerProviderAssets.findFirst({
//       where: eq(brokerProviderAssets.id, assetId)
//     })

//     if (!asset) {
//       throw new Error(`Asset ${assetId} not found`)
//     }

//     // Check if we have any existing calculated asset values
//     const existingCalculatedValues = await db.query.assetValues.findMany({
//       where: and(
//         eq(assetValues.assetId, assetId),
//         eq(assetValues.entryMethod, 'calculated')
//       ),
//       orderBy: sql`${assetValues.recordedAt} DESC`,
//       limit: 1
//     })

//     let historicalBackfillNeeded = false
//     let backfillDateRange: { start: Date; end: Date } | undefined

//     if (existingCalculatedValues.length === 0) {
//       // No calculated values exist - need to backfill from asset creation
//       historicalBackfillNeeded = true
//       backfillDateRange = {
//         start: new Date(asset.createdAt!),
//         end: new Date(currentDate.getTime() - (24 * 60 * 60 * 1000)) // Yesterday
//       }
//     } else {
//       // Check if there are gaps since last calculated value
//       const lastCalculatedValue = existingCalculatedValues[0]!
//       const lastCalculatedDate = new Date(lastCalculatedValue.recordedAt)
//       const daysSinceLastCalculation = Math.floor(
//         (currentDate.getTime() - lastCalculatedDate.getTime()) / (1000 * 60 * 60 * 24)
//       )

//       if (daysSinceLastCalculation > 1) {
//         historicalBackfillNeeded = true
//         backfillDateRange = {
//           start: new Date(lastCalculatedDate.getTime() + (24 * 60 * 60 * 1000)), // Day after last calculation
//           end: new Date(currentDate.getTime() - (24 * 60 * 60 * 1000)) // Yesterday
//         }
//       }
//     }

//     // Step 4: If we're missing price data for current calculation, try to fetch from APIs
//     if (cacheStatus.missingPrices > 0) {
//       // Get securities that need price data
//       const securitiesNeedingPrices = securitiesData.filter(s => 
//         !securitiesWithTodayPrices.has(s.securityId)
//       )

//       // Try to populate price data for today
//       for (const securityData of securitiesNeedingPrices) {
//         try {
//           const populateResult = await populateSecurityDailyHistory(
//             securityData.securityId,
//             currentDate,
//             currentDate
//           )
          
//           if (populateResult.recordsAdded > 0) {
//             cacheStatus.pricesFromAPI++
//             cacheStatus.missingPrices--
//           }
//         } catch (error) {
//           console.warn(`Failed to populate price data for security ${securityData.securityId}:`, error)
//           // Continue with other securities
//         }
//       }

//       // Recalculate with potentially new price data
//       const updatedCalculation = await calculateAssetValueForDate(assetId, currentDate)
//       if (updatedCalculation) {
//         currentCalculation.value = updatedCalculation.value
//         currentCalculation.metadata = updatedCalculation.metadata
//       }
//     }

//     return {
//       currentValue: currentCalculation.value,
//       metadata: currentCalculation.metadata,
//       historicalBackfillNeeded,
//       backfillDateRange,
//       cacheStatus
//     }

//   } catch (error) {
//     console.error(`Error in onSecuritiesUpdated for asset ${assetId}:`, error)
//     throw error
//   }
// }

/**
 * Background job to sync all automated assets
 * @param options - Configuration options for the sync
 * @returns Promise with sync results across all assets
 */
export const bulkSyncAllAutomatedAssets = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: {
    maxConcurrency?: number;
    dateRange?: { start: Date; end: Date };
    dryRun?: boolean;
  }
): Promise<{
  totalAssets: number;
  assetsProcessed: number;
  assetsSkipped: number;
  totalValuesCreated: number;
  errors: Array<{
    assetId: string;
    error: string;
  }>;
  performance: {
    durationMs: number;
    apiCallsMade: number;
    cacheHitRate: number;
  };
}> => {
  // TODO: Implementation
  throw new Error("Not implemented")
}

// ============================================================================
// SYNC MODULE FACTORY
// ============================================================================

export const factory = () => {
  return {
    // Daily history caching
    // populateSecurityDailyHistory,
    // bulkPopulateSecurityDailyHistory,
    
    // Asset value calculation
    // calculateAssetValueForDate,
    // populateAssetValuesForDateRange,
    //onSecuritiesUpdated,
    updateAssetValues,
    calculateAssetValueForDateFromCache,
    bulkSyncAllAutomatedAssets
  }
}