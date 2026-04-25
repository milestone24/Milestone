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
import {
  type AssetPersistence,
  assetPersistenceFactory,
  DatabaseAssetService,
} from "@server/services/assets/database";
import { withConnection } from "@server/db";
import {
  AssetValueMetadataSecurity,
  createDecimalValueString,
  DecimalValueString,
} from "@shared/schema";
import { Decimal } from "decimal.js";
import { EventEmitter } from "node:events";

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

type CalculatedAssetSecurity = AssetSecurity & {
  shareHolding: number;
};

/**
 * Calculate asset value for a specific date using injected securities
 * This will always use the cache and so would always expect the cache to be populated
 * This is in appropriate as in doing large number of calls to the db for cached history for one day.
 */
const calculateAssetValueForDateFromCache = async (
  assetSecurities: CalculatedAssetSecurity[],
  date: Date
): Promise<AssetValueResult | null> => {
  if (assetSecurities.length === 0) {
    return null;
  }

  const securityHistory = await Promise.all(
    assetSecurities.map(async (security) => {
      const history = await getSecurityHistoryForDateRangeCache(
        security.securityId,
        date,
        date
      );

      return history.map((record) => ({
        //TODO: close can not be null
        close: createDecimalValueString(record.close ?? "0"),
        shareHolding: security.shareHolding,
        source: record.source,
        securityName: record.security.name,
        securitySymbol: record.security.symbol,
      }));
    })
  );

  return calculateAssetValue(date, securityHistory);
};

type SecurityHistoryForAssetCalculation = {
  close: DecimalValueString;
  shareHolding: number;
  source: string;
  securityName: string;
  securitySymbol: string;
};

/** Normalise date to YYYY-MM-DD for use as map key (matches cache date handling). */
function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Yields date-range chunks (chunkStart, chunkEnd) for a given range and chunk size in days.
 * Design: async generator for lazy iteration; keeps chunking logic reusable and out of the main loop.
 */
export async function* dateRangeChunks(
  start: Date,
  end: Date,
  chunkDays: number
): AsyncGenerator<{ chunkStart: Date; chunkEnd: Date }> {
  let chunkStart = new Date(start);
  while (chunkStart < end) {
    let chunkEnd = addDays(chunkStart, chunkDays - 1);
    if (chunkEnd > end) {
      chunkEnd = new Date(end);
    }
    yield { chunkStart: new Date(chunkStart), chunkEnd: new Date(chunkEnd) };
    chunkStart = addDays(chunkEnd, 1);
  }
}

/** Preloaded history row shape for one security on one date (no shareHolding; that comes from holdings). */
type HistoryRowForPreloaded = {
  close: string | null;
  source: string;
  securityName: string;
  securitySymbol: string;
};

/**
 * Calculate asset value for one date from a preloaded history map (no DB/cache calls).
 * Design: pure calculation + preloaded data; used by the chunked updater so the inner loop has no I/O.
 */
export function calculateAssetValueForDateFromPreloadedHistory(
  assetSecuritiesWithShareHolding: CalculatedAssetSecurity[],
  date: Date,
  historyBySecurityByDate: Map<string, Map<string, HistoryRowForPreloaded>>
): Promise<AssetValueResult | null> {
  const dateStr = toDateKey(date);
  const securityHistory: SecurityHistoryForAssetCalculation[][] = [];

  for (const security of assetSecuritiesWithShareHolding) {
    const byDate = historyBySecurityByDate.get(security.securityId);
    const row = byDate?.get(dateStr);
    if (!row) {
      continue;
    }
    securityHistory.push([
      {
        close: createDecimalValueString(row.close ?? "0"),
        shareHolding: security.shareHolding,
        source: row.source,
        securityName: row.securityName,
        securitySymbol: row.securitySymbol,
      },
    ]);
  }

  if (securityHistory.length === 0) {
    return Promise.resolve(null);
  }
  return calculateAssetValue(date, securityHistory);
}

const calculateAssetValue = async (
  historyDate: Date,
  securityHistory: SecurityHistoryForAssetCalculation[][]
): Promise<AssetValueResult | null> => {
  const calculationTimestamp = new Date().toISOString();
  let totalValue: Decimal = new Decimal(0);
  let securitiesProcessed = 0;
  const sourcesUsed = new Set<string>();
  const values: AssetValueMetadataSecurity[] = [];

  for (const history of securityHistory) {
    for (const security of history) {
      totalValue = totalValue.add(
        new Decimal(security.close).mul(security.shareHolding)
      );
      securitiesProcessed++;
      sourcesUsed.add(security.source);
      values.push({
        securityName: security.securityName,
        securitySymbol: security.securitySymbol,
        value: createDecimalValueString(
          Decimal.mul(security.close, security.shareHolding).toString()
        ),
        shareHolding: createDecimalValueString(
          security.shareHolding.toString()
        ),
      });
    }
  }

  // Return null if no securities could be valued
  if (securitiesProcessed === 0) {
    return null;
  }

  return {
    value: createDecimalValueString(totalValue.toString()),
    entryMethod: "calculated",
    valueDate: historyDate,
    metadata: {
      calculatedAt: calculationTimestamp,
      securitiesProcessed,
      securitiesTotal: securityHistory.length,
      securities: values,
      dataStatus:
        securitiesProcessed === securityHistory.length ? "complete" : "partial",
      sourcesUsed: Array.from(sourcesUsed), // Dynamic source identifiers from actual services
    },
  };
};

const buildCashOnlyCalculatedValue = (
  valueDate: Date,
  cash: Decimal
): AssetValueResult => {
  const calculatedAt = new Date().toISOString();
  return {
    value: createDecimalValueString(cash.toString()),
    entryMethod: "calculated",
    valueDate,
    metadata: {
      calculatedAt,
      securitiesProcessed: 0,
      securitiesTotal: 0,
      dataStatus: "complete",
      sourcesUsed: [],
      securities: [],
    },
  };
};

const addCashToCalculatedValueIfNeeded = async (
  assetValueResult: AssetValueResult | null,
  isCalculated: boolean,
  valueDate: Date,
  getCash: () => Promise<Decimal>
): Promise<AssetValueResult | null> => {
  if (!isCalculated) {
    return assetValueResult;
  }
  const cash = await getCash();
  if (assetValueResult?.metadata.dataStatus === "complete") {
    return {
      ...assetValueResult,
      value: createDecimalValueString(
        new Decimal(assetValueResult.value).add(cash).toString()
      ),
    };
  }
  if (!assetValueResult && cash.gt(0)) {
    return buildCashOnlyCalculatedValue(valueDate, cash);
  }
  return assetValueResult;
};

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

type Data = {
  assetId: string;
  accountId: string;
  jobId: string;
  startDate?: Date;
};

type EventType = "started" | "completed" | "failed" | "aborted" | "exited";

type EmitEvents = {
  [k in EventType]: [data: Data];
};

type TouchProcess = (() => void) | (() => Promise<void>);

/**
 * Returns true if work should continue, false if it should stop.
 * When provided to the updater, the implementation must use the **same** AbortSignal
 * as the updater's `abortSignal` (e.g. `() => shouldContinue(abortSignal, { jobId })`),
 * optionally combined with DB state. When not provided, `abortSignal.aborted` should
 * be checked where appropriate.
 */
type AbortCheck = () => Promise<boolean>;

/** Context passed to both legacy and chunked asset-value updaters (single-argument shape). */
export type AssetValuesUpdateContext = {
  assetId: string;
  accountId: string;
  jobId: string;
  startDate: Date | null;
  abortSignal: AbortSignal;
  eventEmitter: EventEmitter<EmitEvents>;
  touchProcess?: TouchProcess;
  abortCheck?: AbortCheck;
};

const __updateAssetValues = async (
  ctx: AssetValuesUpdateContext,
  assetPersistence: AssetPersistence
): Promise<void> => {
  const { assetId, accountId, jobId, startDate, abortSignal, eventEmitter, touchProcess, abortCheck } = ctx;

  console.log("AssetValuesUpdater START assetId=%s accountId=%s jobId=%s", assetId, accountId, jobId);

  const shouldStop = async (): Promise<boolean> =>
    abortCheck ? !(await abortCheck()) : abortSignal.aborted;

  if (startDate) {
    await assetPersistence.removeAssetValuesFromDate(startDate);
  }

  const emitData: Data = {
    assetId,
    accountId,
    jobId,
  };

  if (await shouldStop()) {
    eventEmitter.emit("aborted", emitData);
    eventEmitter.emit("exited", emitData);
    return;
  }



  eventEmitter.emit("started", emitData);

  const assetSecurities = await assetPersistence.getAssetSecurities();
  const { valueMethod } = await assetPersistence.getAssetById();
  const isCalculated = valueMethod === "calculated";

  const earliestSecurityStartDate = assetSecurities.reduce((min, security) => {
    return security.startDate < min ? security.startDate : min;
  }, new Date());

  const lastAssetValue = await assetPersistence.getLastAssetValue();
  const lastValueDatePlusADay = lastAssetValue
    ? new Date(
      new Date(lastAssetValue.valueDate).getTime() + 24 * 60 * 60 * 1000
    )
    : null;

  let currentDate = lastValueDatePlusADay
    ? lastValueDatePlusADay > earliestSecurityStartDate
      ? lastValueDatePlusADay
      : earliestSecurityStartDate
    : earliestSecurityStartDate;

  const values: AssetValueResult[] = [];

  const todayMinusOne = new Date();
  todayMinusOne.setDate(todayMinusOne.getDate() - 1);

  /*
      Instead of the while loop,
      we should create a set of groups of dates.
      So a group wold be 7 days or less.
      There would be a parent group representing one month or closest to one month.
      Then we can run batches with concurrency.
  */

  while (currentDate < todayMinusOne) {
    if (await shouldStop()) {
      eventEmitter.emit("aborted", emitData);
      eventEmitter.emit("exited", emitData);
      break;
    }

    const assetSecurityShareHoldings =
      await assetPersistence.getAssetSecurityShareHoldingsForDate(currentDate);

    const assetSecuritiesWithShareHolding: CalculatedAssetSecurity[] =
      assetSecurities.map((security) => {
        const shareholding = assetSecurityShareHoldings.find(
          (shareholding) => shareholding.securityId === security.securityId
        );
        return {
          ...security,
          shareHolding: shareholding?.shareHolding ?? 0,
        };
      });

    let assetValueResult = await calculateAssetValueForDateFromCache(
      assetSecuritiesWithShareHolding,
      currentDate
    );

    if (await shouldStop()) {
      eventEmitter.emit("aborted", emitData);
      eventEmitter.emit("exited", emitData);
      break;
    }

    assetValueResult = await addCashToCalculatedValueIfNeeded(
      assetValueResult,
      isCalculated,
      currentDate,
      () => assetPersistence.getAssetCashBalanceAsOfDate(currentDate)
    );

    if (assetValueResult) {
      if (assetValueResult.metadata.dataStatus === "complete") {
        values.push(assetValueResult);
      }
    } else {
      //TODO: Handle this
    }

    // Heartbeat: touch process row so updatedAt advances for TTL/reconciliation. A timer-based touch (e.g. every N min) is a possible future improvement for long batches.
    await touchProcess?.();

    currentDate = addDays(currentDate, 1);
  }

  if (await shouldStop()) {
    eventEmitter.emit("aborted", emitData);
    eventEmitter.emit("exited", emitData);
    return;
  }

  const today = new Date();

  if (values.length > 0) {
    await assetPersistence.insertAssetValues(
      values.map((value) => ({
        value: value.value,
        recordedAt: today,
        valueDate: value.valueDate,
        entryMethod: value.entryMethod,
        metadata: value.metadata,
      }))
    );
    eventEmitter.emit("completed", emitData);
    eventEmitter.emit("exited", emitData);
  } else {
    console.log("NO ASSET VALUES TO INSERT", assetId, accountId, jobId);
    eventEmitter.emit("completed", emitData);
    eventEmitter.emit("exited", emitData);
  }

  console.log("AssetValuesUpdater END assetId=%s accountId=%s jobId=%s", assetId, accountId, jobId);
};

/** Chunk size in days for the chunked updater (bounded memory, persist per chunk). */
const CHUNK_DAYS = 30;

/**
 * Chunked asset-value updater: processes the date range in bounded chunks, writes each chunk
 * to the session's temp table, and merges into asset_values only on full success (no merge on abort).
 *
 * Design patterns: staging table + merge (ETL-style); chunked/batch processing; async generator
 * for chunk iteration; two-phase write (commit to real table only after full run); pure calculation
 * + preloaded data per chunk; concurrency (parallel history fetch per chunk). Call only when
 * persistence is backed by a session-scoped connection (e.g. via db.withConnection).
 */
export const __updateAssetValuesChunked = async (
  ctx: AssetValuesUpdateContext,
  sessionPersistence: AssetPersistence
): Promise<void> => {
  const { assetId, accountId, jobId, startDate, abortSignal, eventEmitter, touchProcess, abortCheck } = ctx;

  console.log(
    "AssetValuesUpdaterChunked START assetId=%s accountId=%s jobId=%s",
    assetId,
    accountId,
    jobId
  );

  const shouldStop = async (): Promise<boolean> =>
    abortCheck ? !(await abortCheck()) : abortSignal.aborted;

  if (startDate) {
    await sessionPersistence.removeAssetValuesFromDate(startDate);
  }

  const emitData: Data = { assetId, accountId, jobId };

  if (await shouldStop()) {
    eventEmitter.emit("aborted", emitData);
    eventEmitter.emit("exited", emitData);
    console.log(
      "AssetValuesUpdaterChunked END assetId=%s accountId=%s jobId=%s outcome=aborted",
      assetId,
      accountId,
      jobId
    );
    return;
  }

  eventEmitter.emit("started", emitData);

  const assetSecurities = await sessionPersistence.getAssetSecurities();
  const { valueMethod } = await sessionPersistence.getAssetById();
  const isCalculated = valueMethod === "calculated";
  const earliestSecurityStartDate = assetSecurities.reduce(
    (min, s) => (s.startDate < min ? s.startDate : min),
    new Date()
  );
  const lastAssetValue = await sessionPersistence.getLastAssetValue();
  const lastValueDatePlusADay = lastAssetValue
    ? new Date(
        new Date(lastAssetValue.valueDate).getTime() + 24 * 60 * 60 * 1000
      )
    : null;
  let currentDate = lastValueDatePlusADay
    ? lastValueDatePlusADay > earliestSecurityStartDate
      ? lastValueDatePlusADay
      : earliestSecurityStartDate
    : earliestSecurityStartDate;

  const todayMinusOne = new Date();
  todayMinusOne.setDate(todayMinusOne.getDate() - 1);

  await sessionPersistence.createTempTableForAssetValues();

  let aborted = false;
  const runStartDate = new Date(currentDate);
  const runEndDate = new Date(todayMinusOne);

  try {
    for await (const { chunkStart, chunkEnd } of dateRangeChunks(
      currentDate,
      todayMinusOne,
      CHUNK_DAYS
    )) {
      if (await shouldStop()) {
        aborted = true;
        eventEmitter.emit("aborted", emitData);
        eventEmitter.emit("exited", emitData);
        console.log(
          "AssetValuesUpdaterChunked END assetId=%s accountId=%s jobId=%s outcome=aborted",
          assetId,
          accountId,
          jobId
        );
        return;
      }

      const historyResults = await Promise.all(
        assetSecurities.map((s) =>
          getSecurityHistoryForDateRangeCache(s.securityId, chunkStart, chunkEnd)
        )
      );

      const historyBySecurityByDate = new Map<
        string,
        Map<string, HistoryRowForPreloaded>
      >();
      assetSecurities.forEach((security, i) => {
        const rows = historyResults[i] ?? [];
        const byDate = new Map<string, HistoryRowForPreloaded>();
        for (const record of rows) {
          const dateStr =
            typeof record.date === "string"
              ? record.date
              : toDateKey(new Date(record.date));
          byDate.set(dateStr, {
            close: record.close,
            source: record.source,
            securityName: record.security.name,
            securitySymbol: record.security.symbol,
          });
        }
        historyBySecurityByDate.set(security.securityId, byDate);
      });

      const chunkValues: AssetValueResult[] = [];
      let day = new Date(chunkStart);
      while (day <= chunkEnd) {
        if (await shouldStop()) {
          aborted = true;
          eventEmitter.emit("aborted", emitData);
          eventEmitter.emit("exited", emitData);
          console.log(
            "AssetValuesUpdaterChunked END assetId=%s accountId=%s jobId=%s outcome=aborted",
            assetId,
            accountId,
            jobId
          );
          return;
        }
        const holdings =
          await sessionPersistence.getAssetSecurityShareHoldingsForDate(day);
        const withHolding: CalculatedAssetSecurity[] = assetSecurities.map(
          (s) => {
            const h = holdings.find((x) => x.securityId === s.securityId);
            return { ...s, shareHolding: h?.shareHolding ?? 0 };
          }
        );
        let result = await calculateAssetValueForDateFromPreloadedHistory(
          withHolding,
          day,
          historyBySecurityByDate
        );
        result = await addCashToCalculatedValueIfNeeded(
          result,
          isCalculated,
          day,
          () => sessionPersistence.getAssetCashBalanceAsOfDate(day)
        );
        if (result?.metadata.dataStatus === "complete") {
          chunkValues.push(result);
        }
        day = addDays(day, 1);
      }

      if (chunkValues.length > 0) {
        await sessionPersistence.insertAssetValuesStaging(
          chunkValues.map((v) => ({
            value: v.value,
            recordedAt: new Date(),
            valueDate: v.valueDate,
            entryMethod: v.entryMethod,
            metadata: v.metadata,
          }))
        );
      }

      await touchProcess?.();
    }

    if (await shouldStop()) {
      aborted = true;
      eventEmitter.emit("aborted", emitData);
      eventEmitter.emit("exited", emitData);
      console.log(
        "AssetValuesUpdaterChunked END assetId=%s accountId=%s jobId=%s outcome=aborted",
        assetId,
        accountId,
        jobId
      );
      return;
    }

    if (!aborted) {
      await sessionPersistence.mergeStagingIntoAssetValues(
        runStartDate,
        runEndDate
      );
      eventEmitter.emit("completed", emitData);
      eventEmitter.emit("exited", emitData);
      console.log(
        "AssetValuesUpdaterChunked END assetId=%s accountId=%s jobId=%s outcome=completed",
        assetId,
        accountId,
        jobId
      );
    }

    console.log("AssetValuesUpdaterChunked END assetId=%s accountId=%s jobId=%s outcome=completed", assetId, accountId, jobId);
  } finally {
    await sessionPersistence.clearStagingForJob();
  }
};

/**
 * Emits exactly one outcome (completed | failed | aborted) per run, then "exited".
 * "started" is emitted at most once when work begins. No two outcome types for the same run.
 */
export class AssetValuesUpdater extends EventEmitter<EmitEvents> {
  /**
   * @param abortCheck - Optional. When provided, must be implemented using the same `abortSignal`
   * (e.g. `() => shouldContinue(abortSignal, { jobId })`). When omitted, `abortSignal.aborted` should be checked where appropriate.
   */
  constructor(
    private assetId: string,
    private accountId: string,
    private jobId: string,
    private startDate: Date | null,
    private assetPersistence: AssetPersistence,
    private abortSignal: AbortSignal,
    private touchProcess?: TouchProcess,
    private abortCheck?: AbortCheck
  ) {
    super();
  }

  private getUpdateContext(): AssetValuesUpdateContext {
    return {
      assetId: this.assetId,
      accountId: this.accountId,
      jobId: this.jobId,
      startDate: this.startDate,
      abortSignal: this.abortSignal,
      eventEmitter: this,
      touchProcess: this.touchProcess,
      abortCheck: this.abortCheck,
    };
  }

  async update() {
    const emitData: Data = {
      assetId: this.assetId,
      accountId: this.accountId,
      jobId: this.jobId,
      ...(this.startDate !== null && { startDate: this.startDate }),
    };
    withConnection(async (sessionDb) => {
      const sessionPersistence = assetPersistenceFactory(
        new DatabaseAssetService(sessionDb),
        this.assetId
      );
      return __updateAssetValuesChunked(this.getUpdateContext(), sessionPersistence);
    }).catch((error) => {
      console.error("Error updating asset values assetId=%s accountId=%s jobId=%s", this.assetId, this.accountId, this.jobId, error);
      this.emit("failed", emitData);
      this.emit("exited", emitData);
    });
    return this;
  }
}

// export const updateAssetValuesSync = async (
//   assetPersistence: AssetPersistence,
//   abortSignal: AbortSignal,
//   callback: (status: ProcessStatus) => void,
//   startDate?: Date
// ) => {
//   const updater = new AssetValuesUpdater(
//     assetPersistence,
//     abortSignal,
//     startDate
//   );
//   callback("completed");
// };

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
  throw new Error("Not implemented");
};

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
    //updateAssetValues,
    calculateAssetValueForDateFromCache,
    bulkSyncAllAutomatedAssets,
  };
};