import { db } from "@server/db"
import { securities, securityDailyHistory } from "@server/db/schema/securities"
import { SecurityContext, SecurityHistory } from "../types"
import { eq, sql } from "drizzle-orm"
import { factory as gatewayFactory } from "../gateway"
import { differenceInDays } from "date-fns"
import EventEmitter from "events";

/**
 * Fetch and process security history data for a date range
 * @param security - The security to fetch history for
 * @param datesToFetch - Array of dates to fetch
 * @returns Promise with processed history data
 */
export const fetchFilteredSecurityHistoryForDates = async (
  securityIdentifier: { symbol: string; exchange?: string },
  datesToFetch: [Date, Date],
  abortSignal: AbortSignal
): Promise<SecurityHistory[]> => {
  const gateway = gatewayFactory();

  try {
    const gatewayData = await gateway.getSecurityHistoryForDateRange(
      securityIdentifier,
      datesToFetch[0],
      datesToFetch[1]
    );

    // console.log("GATEWAY DATA first", gatewayData.at(0))

    // console.log("GATEWAY DATA last", gatewayData.at(-1))

    // console.log("DATES TO FETCH", datesToFetch)

    /**
     * Although we give the gateway a date range, it is not gauranteed that it will return data for all dates in the range.
     * We need to filter the data to only include the dates that were actually fetched.
     */
    // const filteredData = gatewayData
    //   .filter(item => datesToFetch.some(date =>
    //     date.toISOString().split('T')[0] === item.date.toISOString().split('T')[0]
    //   ))

    return gatewayData;
  } catch (error) {
    throw new Error(
      `Gateway API error: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Populate security daily history for a specific security.
 * This will be general used for a broker provider asset security.
 * But, later there could be a case when the security belongs to something else.
 * However it should only be called in the context of a security container
 * where a start date can be defined.
 * If the security is a fresh entry then there will be zero history cached
 * and so a start date will be needed.
 * @returns Promise with cache population results
 */
/**
 * Returns true if work should continue, false if it should stop.
 * When provided to the updater, the implementation must use the **same** AbortSignal
 * as the updater's `abortSignal` (e.g. `() => shouldContinue(abortSignal, { jobId })`),
 * optionally combined with DB state. When not provided, `abortSignal.aborted` should
 * be checked where appropriate.
 */
type AbortCheck = () => Promise<boolean>;

type TouchProcess = (() => void) | (() => Promise<void>);

const populateSecurityDailyHistoryCache = async (
  securityContext: SecurityContext,
  jobId: string,
  abortSignal: AbortSignal,
  abortCheck?: AbortCheck,
  touchProcess?: TouchProcess
): Promise<Date[]> => {
  const shouldStop = async (): Promise<boolean> =>
    abortCheck ? !(await abortCheck()) : abortSignal.aborted;

  if (await shouldStop()) {
    return [];
  }

  touchProcess?.();

  // console.log("populateSecurityDailyHistoryCache SECURITY CONTEXT", securityContext)

  const { securityId, startDate } = securityContext;

  const security = await db.query.securities.findFirst({
    where: eq(securities.id, securityId),
  });

  // console.log("populateSecurityDailyHistoryCache SECURITY", security)

  if (!security) {
    throw new Error(`Security with ID ${securityId} not found`);
  }

  const lastRecord = await db.query.securityDailyHistory.findFirst({
    where: eq(securityDailyHistory.securityId, securityId),
    orderBy: sql`${securityDailyHistory.date} DESC`,
  });

  if (await shouldStop()) {
    return [];
  }

  //console.log("populateSecurityDailyHistoryCache LAST RECORD", lastRecord)

  //Before it was presumed that hen giving a start date to the gateway (particularly eodhd) it would actually start
  //from the day after the start date. It is now believed that this is not the case and what was seen before was
  //due to non business days where teh markets are closed.

  let lastRecordDate = lastRecord?.date
    ? new Date(new Date(lastRecord.date).getTime() + 24 * 60 * 60 * 1000) //Add 1 day to the last record date
    : null;

  const dateRange: [Date, Date] = [lastRecordDate ?? startDate, new Date()];

  //console.log("populateSecurityDailyHistoryCache DATE RANGE", dateRange);

  //PAss the abort signal to the fetchFilteredSecurityHistoryForDates function
  const securityHistory = await fetchFilteredSecurityHistoryForDates(
    {
      symbol: security.symbol,
      exchange: security.exchange ?? undefined, //TODO Should not allow undefined
    },
    //We need to fill the security history from the last date we have,
    // or the start date of the security until today
    dateRange,
    abortSignal
  );

  touchProcess?.();

  if (await shouldStop()) {
    return [];
  }

  //We should not throw this error.
  //How ever this error should never need to be thrown as prelimary checks should see
  //no further history is needed.

  // if(securityHistory.length === 0) {
  //   throw new Error(`No security history found for ${security.symbol}`)
  // }

  //TODO If last record is yesterday we should not fetch as we should have already fetch up until yesterday.
  //We should consider if we attempt to detect if teh market should have closed today, then fetch or try
  // the live data API. For asset values maybe we should not store values of unclosed markets. This should only
  //be visible when the user is looking at the assets individual securities.

  if (securityHistory.length === 0) {
    return [];
  }

  if (lastRecord) {
    //If the last record existed we need to:
    //1. check the date of the last record of cache and the first record obtained from the gateway match
    //2. if they do not match, we need to fill the gap
    //3. check that the market price values match and if not update the last record in cache.
    // This is particlarly important for the close price. at this time, and as the gateway supports more APIS,
    // we are unsure what the close price will be if the last day is today and the market is still open.

    const lastRecordDate = new Date(lastRecord.date);
    const firstRecordDate = new Date(securityHistory[0]!.date);
    const lastRecordClose = Number(lastRecord.close);
    const firstRecordClose = Number(securityHistory[0]!.close);

    if (lastRecordDate.getTime() !== firstRecordDate.getTime()) {
      //We need to fill the gap
      const gapDays = differenceInDays(firstRecordDate, lastRecordDate);

      if (gapDays > 0) {
        //We are going to skip this as days could be missing due to weekends or holidays
        //throw new Error(`Gap found in security history for ${security.symbol}`)
      }

      if (lastRecordClose !== firstRecordClose) {
        //We need to update the last record in cache
        await db
          .update(securityDailyHistory)
          .set({ close: firstRecordClose.toString() })
          .where(eq(securityDailyHistory.id, lastRecord.id));
      }
    }
  }

  if (await shouldStop()) {
    return [];
  }

  await db.transaction(async (tx) => {
    await tx.insert(securityDailyHistory).values(
      securityHistory.map((record) => ({
        securityId,
        date: record.date.toISOString().split("T")[0]!,
        open: record.open.toString(),
        high: record.high.toString(),
        low: record.low.toString(),
        close: record.close.toString(),
        source: record.sourceIdentifier,
      }))
    );
    if (await shouldStop()) {
      tx.rollback();
    }
  });

  touchProcess?.();

  if (await shouldStop()) {
    return [];
  }

  return securityHistory.map((record) => record.date);
};

type Data = {
  jobId: string;
};

type EventType = "started" | "completed" | "failed" | "aborted" | "exited";

type EmitEvents = {
  [k in EventType]: [data: Data];
};

export const populateSecuritiesDailyHistoryCache = async (
  securityContexts: SecurityContext[],
  jobId: string,
  abortSignal: AbortSignal,
  eventEmitter: EventEmitter<EmitEvents>,
  touchProcess?: TouchProcess,
  abortCheck?: AbortCheck
): Promise<Date[][]> => {
  const shouldStop = async (): Promise<boolean> =>
    abortCheck ? !(await abortCheck()) : abortSignal.aborted;

  console.log(
    "populateSecuritiesDailyHistoryCache securityContexts",
    securityContexts
  );

  // Heartbeat: touch process row at boundaries (per-security start, after fetch, after insert) so updatedAt advances for TTL/reconciliation. A timer-based touch (e.g. every N min) is a possible future improvement for long batches.
  const populatePromises = Promise.all(
    securityContexts.map((securityContext) =>
      populateSecurityDailyHistoryCache(
        securityContext,
        jobId,
        abortSignal,
        abortCheck,
        touchProcess
      ).then((result) => {
        touchProcess?.();
        return result;
      })
    )
  );

  const results = await populatePromises;

  if (await shouldStop()) {
    return [];
  }

  console.log("populateSecuritiesDailyHistoryCache results", results);
  return results;
};

/**
 * Emits exactly one outcome (completed | failed | aborted) per run, then "exited".
 * "started" is emitted at most once when work begins. No two outcome types for the same run.
 */
export class SecuritiesCacheUpdater extends EventEmitter<EmitEvents> {
  /**
   * @param abortCheck - Optional. When provided, must be implemented using the same `abortSignal`
   * (e.g. `() => shouldContinue(abortSignal, { jobId })`). When omitted, `abortSignal.aborted` should be checked where appropriate.
   */
  constructor(
    private jobId: string,
    private securityContexts: SecurityContext[],
    private abortSignal: AbortSignal,
    private touchProcess?: TouchProcess,
    private abortCheck?: AbortCheck
  ) {
    super();
  }
  async update() {
    console.log("SecuritiesCacheUpdater started", this.jobId);
    this.emit("started", { jobId: this.jobId });
    populateSecuritiesDailyHistoryCache(
      this.securityContexts,
      this.jobId,
      this.abortSignal,
      this,
      this.touchProcess,
      this.abortCheck
    )
      .then(async () => {
        const stopped = this.abortCheck
          ? !(await this.abortCheck())
          : this.abortSignal.aborted;
        if (stopped) {
          this.emit("aborted", { jobId: this.jobId });
          this.emit("exited", { jobId: this.jobId });
          return;
        }
        this.emit("completed", { jobId: this.jobId });
        this.emit("exited", { jobId: this.jobId });
      })
      .catch((error) => {
        this.emit("failed", { jobId: this.jobId });
        this.emit("exited", { jobId: this.jobId });
        //throw error;
      });
    return this;
  }
}

/** Old ** */

type BulkPopulateSecurityDailyHistoryResult = {
  securityId: string;
  success: boolean;
  recordsAdded: Date[];
  errors: string[];
};

/**
 * Populate security daily history for multiple securities in parallel
 * @param requests - Array of security IDs and date ranges
 * @returns Promise with results for each security
 */
export const bulkPopulateSecurityDailyHistory = async (
  requests: Array<SecurityContext>,
  jobId: string,
  abortSignal: AbortSignal,
  eventEmitter: EventEmitter<EmitEvents>
): Promise<BulkPopulateSecurityDailyHistoryResult[]> => {
  const results: BulkPopulateSecurityDailyHistoryResult[] = [];

  // Process requests in parallel with controlled concurrency
  const CONCURRENCY_LIMIT = 5; // Prevent overwhelming the APIs

  const processRequest = async (
    request: SecurityContext
  ): Promise<BulkPopulateSecurityDailyHistoryResult> => {
    try {
      const populateResult = await populateSecurityDailyHistoryCache(
        request,
        jobId,
        abortSignal
      );

      return {
        securityId: request.securityId,
        success: true,
        recordsAdded: populateResult,
        errors: [],
      };
    } catch (error) {
      return {
        securityId: request.securityId,
        success: false,
        recordsAdded: [],
        errors: [
          `Failed to process: ${error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  };

  // Process requests in batches to control concurrency
  for (let i = 0; i < requests.length; i += CONCURRENCY_LIMIT) {
    const batch = requests.slice(i, i + CONCURRENCY_LIMIT);
    const batchPromises = batch.map(processRequest);

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      // Handle any unexpected batch failures
      const failedResults = batch.map((request) => ({
        securityId: request.securityId,
        success: false,
        recordsAdded: [],
        errors: [
          `Batch processing failed: ${error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      }));
      results.push(...failedResults);
    }

    // Small delay between batches to be respectful to APIs
    if (i + CONCURRENCY_LIMIT < requests.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  return results;
};

export const factory = () => {
  return {
    fetchFilteredSecurityHistoryForDates,
    populateSecurityDailyHistoryCache,
    populateSecuritiesDailyHistoryCache,
    bulkPopulateSecurityDailyHistory
  }
}