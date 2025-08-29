import {
  UserAsset,
  AssetsChange,
  AssetValue,
  AssetWithHistory,
  AssetWithValueHistoryAsyncIterators,
  AssetWithValueHistoryIterators,
  DataRangeQuery,
  PortfolioHistoryTimePoint,
  PossibleDummyAssetValue,
  WithAccountChange,
} from "@shared/schema";
import { start } from "node:repl";
import { arrayToAsyncIterator } from "./async";

export const resolveDate = (
  date: string | Date | null | undefined
): Date | null => {
  return date ? (typeof date === "string" ? new Date(date) : date) : null;
};

/**
 * A simple helper function to resolve the asset value for a given index ensuring that the asset values are sorted by date.
 */
const resolveAssetValuesForIndexes = (
  assetValues: PossibleDummyAssetValue[],
  ...indexes: number[]
): (PossibleDummyAssetValue | null)[] => {
  const sorted = assetValues.toSorted(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
  return indexes.map((index) => sorted.at(index) ?? null);
};

const normalisePercentage = (valueOne: number, valueTwo: number): number => {
  return valueOne === 0
    ? valueTwo > 0
      ? 100
      : 0
    : ((valueTwo - valueOne) / valueOne) * 100;
};

export const calculateAssetsChange = (
  assetValues: PossibleDummyAssetValue[]
): AssetsChange => {
  const [firstAssetValue, lastAssetValue] = resolveAssetValuesForIndexes(
    assetValues,
    0,
    -1
  );

  let percentageChange = 0;
  let currencyChange = 0;

  return firstAssetValue
    ? lastAssetValue
      ? ((percentageChange = normalisePercentage(
          firstAssetValue.value,
          lastAssetValue.value
        )),
        {
          startDate: firstAssetValue.recordedAt,
          endDate: lastAssetValue.recordedAt,
          startValue: firstAssetValue.value,
          value: lastAssetValue.value,
          currentChange: lastAssetValue.value - firstAssetValue.value,
          currentChangePercentage: percentageChange,
        })
      : {
          startDate: firstAssetValue.recordedAt,
          endDate: firstAssetValue.recordedAt,
          startValue: firstAssetValue.value,
          value: firstAssetValue.value,
          currentChange: firstAssetValue.value - firstAssetValue.value,
          currentChangePercentage: percentageChange,
        }
    : {
        startDate: null,
        endDate: null,
        startValue: 0,
        value: 0,
        currentChange: 0,
        currentChangePercentage: 0,
      };
};

/**
 * Normalize a date to UTC midnight for robust day-level comparison.
 */
function toUTCMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Returns asset values for a given date range, ensuring the range is fully covered.
 *
 * This function sorts the asset values by date and slices them to fit within the specified date range.
 * If there is no asset value exactly on the start or end date, it creates a synthetic value at those boundaries:
 *   - For the start date: If no value exists, it inserts a synthetic value using the last known value before the range (or zero if none exists).
 *   - For the end date: If no value exists, it inserts a synthetic value using the last known value before the end (or zero if none exists).
 *
 * This is particularly important for graphing and reporting, as it ensures the returned data always covers the full requested range.
 * Synthetic values guarantee that charts and calculations (like percentage change) have a value at both the start and end of the range,
 * even if the underlying data is sparse or missing for those exact days.
 *
 * @param assetValues Array of asset value history objects
 * @param query Optional date range with start and/or end
 * @returns Array of asset values (real and possibly synthetic) covering the requested range, sorted by date
 */
const defineAssetValuesForDateRange = (
  assetValues: AssetValue[],
  query?: DataRangeQuery
): PossibleDummyAssetValue[] => {
  const assetValuesSorted = assetValues.sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );

  const queryStartDate = resolveDate(query?.start);
  const queryEndDate = resolveDate(query?.end);

  const withStartPoint: (
    values: PossibleDummyAssetValue[]
  ) => PossibleDummyAssetValue[] = queryStartDate
    ? (values) => {
      /**
       * We see if there is a value that exists for the queryStartDate matching its day only.
       * We filter and take the first from the sorted array because there might be multiple values for the same date with different times
       * Here we only match the day not the time, we are relying on the sorted array so that this will match the earliest
       * if there are more than on asset values for that day.
       * We set the value as NaN to indicate that this does not have a value because the queryStartDate does not exist.
       */
      const valueIndexForQueryStartDate = values.findIndex(
        (assetValue) =>
          assetValue.recordedAt.getUTCFullYear() ===
            queryStartDate.getUTCFullYear() &&
          assetValue.recordedAt.getUTCMonth() ===
            queryStartDate.getUTCMonth() &&
          assetValue.recordedAt.getUTCDate() === queryStartDate.getUTCDate()
      );
      const lastValueIndexBeforeQueryStartDate = values.findLastIndex(
        (assetValue) => assetValue.recordedAt < queryStartDate
      );
      const lastValueBeforeQueryStartDate =
        values[lastValueIndexBeforeQueryStartDate];

      const addStartPoint = (
        assetValue: Omit<PossibleDummyAssetValue, "recordedAt">,
        slicePoint: number
      ) => [
        {
          ...assetValue,
          recordedAt: queryStartDate,
        },
        ...values.slice(slicePoint),
      ];

      return valueIndexForQueryStartDate > -1
        ? values.slice(valueIndexForQueryStartDate)
        : lastValueBeforeQueryStartDate
        ? addStartPoint(
            lastValueBeforeQueryStartDate,
            valueIndexForQueryStartDate
          )
        : addStartPoint(
            {
              id: null,
              value: 0,
              assetId: values[0]?.assetId ?? "",
              createdAt: queryStartDate,
              updatedAt: queryStartDate,
              valueDate: queryStartDate,
              entryMethod: "manual",
              metadata: {},
            },
            valueIndexForQueryStartDate
          );
    }
    : (values) => {
        return values.slice();
      };

  const withEndPoint: (
    values: PossibleDummyAssetValue[]
  ) => PossibleDummyAssetValue[] = queryEndDate
    ? (values) => {
      /**
       * We see if there is a value that exists for the queryEndDate matching its day only.
       * We filter and take the last from the sorted array because there might be multiple values for the same date with different times
       * Here we only match the day not the time, we are relying on the sorted array so that this will match the latest
       * if there are more than on asset values for that day.
       * We set the value as NaN to indicate that this does not have a value because the queryEndDate does not exist.
       */
      const valueIndexForQueryEndDate = assetValuesSorted.findLastIndex(
        (assetValue) =>
          assetValue.recordedAt.getUTCFullYear() ===
            queryEndDate.getUTCFullYear() &&
          assetValue.recordedAt.getUTCMonth() === queryEndDate.getUTCMonth() &&
          assetValue.recordedAt.getUTCDate() === queryEndDate.getUTCDate()
      );

      const lastValueIndexBeforeQueryEndDate = assetValuesSorted.findLastIndex(
        (assetValue) => assetValue.recordedAt < queryEndDate
      );
      const lastValueBeforeQueryEndDate =
        values[lastValueIndexBeforeQueryEndDate];

      const addEndPoint = (
        assetValue: Omit<PossibleDummyAssetValue, "recordedAt">,
        slicePoint: number
      ) => [
        ...values.slice(0, slicePoint),
        {
          ...assetValue,
          recordedAt: queryEndDate,
        },
      ];

      return valueIndexForQueryEndDate > 1
        ? values.slice(0, valueIndexForQueryEndDate)
        : lastValueBeforeQueryEndDate
        ? addEndPoint(lastValueBeforeQueryEndDate, valueIndexForQueryEndDate)
        : addEndPoint(
            {
              id: null,
              value: 0,
              assetId: values[0]?.assetId ?? "",
              createdAt: queryEndDate,
              updatedAt: queryEndDate,
              valueDate: queryEndDate,
              entryMethod: "manual",
              metadata: {},
            },
            valueIndexForQueryEndDate
          );
    }
    : (values) => {
        return values.slice();
      };

  return withEndPoint(withStartPoint(assetValuesSorted)).sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
};

/**
 * Async factory function that returns a streaming, range-aware async generator for asset values.
 *
 * This function enables memory-efficient, single-pass processing of large, sorted async streams of asset values.
 * It yields all values within the specified date range, and inserts synthetic start/end values if needed.
 * Only minimal state is buffered (last value before start, last value seen, etc.).
 *
 * Input must be an async generator (or async iterator) yielding asset values in ascending order by recordedAt.
 *
 * Usage:
 *   const stream = asyncStreamAssetValuesForDateRange(query)(mergeSortedAssetHistories(assets));
 *   for await (const value of stream) {
 *     // process value
 *   }
 *
 * @param query Optional date range with start and/or end
 * @returns An async generator function that takes a sorted async generator of asset values and yields values (real and synthetic) within the range
 */
export function streamAssetValuesForDateRange(query?: DataRangeQuery) {
  //Do not delete this comment it is for reference to allow flexibility later
  // return async function* (assetValues: AsyncGenerator<PossibleDummyAssetValue, void, unknown> | AsyncIterator<PossibleDummyAssetValue>): AsyncGenerator<PossibleDummyAssetValue> {
  return async function* (
    assetValues: AsyncIterator<PossibleDummyAssetValue>
  ): AsyncGenerator<PossibleDummyAssetValue> {
    //console.log("streamAssetValuesForDateRange query FFFF :", query);

    const queryStartDate = resolveDate(query?.start);
    const queryEndDate = resolveDate(query?.end);

    let lastBeforeStart: PossibleDummyAssetValue | null = null;
    let yieldedStart = false;
    let yieldedEnd = false;
    let lastValue: PossibleDummyAssetValue | null = null;

    let next = await assetValues.next();
    while (!next.done) {
      const value = next.value;

      //console.log("streamAssetValuesForDateRange value :", value);

      // Track last value before start
      if (queryStartDate && value.recordedAt < queryStartDate) {
        lastBeforeStart = value;
        lastValue = value;
        next = await assetValues.next();
        continue;
      }

      // Handle synthetic start
      if (queryStartDate && !yieldedStart) {
        if (
          value.recordedAt.getUTCFullYear() ===
            queryStartDate.getUTCFullYear() &&
          value.recordedAt.getUTCMonth() === queryStartDate.getUTCMonth() &&
          value.recordedAt.getUTCDate() === queryStartDate.getUTCDate()
        ) {
          yield value;
        } else {
          // Insert synthetic start value
          yield {
            ...(lastBeforeStart ?? {
              id: null,
              value: 0,
              assetId: "SYNTH",
              createdAt: queryStartDate,
              updatedAt: queryStartDate,
              valueDate: queryStartDate,
              entryMethod: "manual",
              metadata: {},
            }),
            recordedAt: queryStartDate,
          };
          // Then yield current value if within range
          if (!queryEndDate || value.recordedAt <= queryEndDate) {
            yield value;
          }
        }
        yieldedStart = true;
        lastValue = value;
        next = await assetValues.next();
        continue;
      }

      // If after end, yield synthetic end and finish
      if (queryEndDate && value.recordedAt > queryEndDate) {
        if (!yieldedEnd) {
          //console.log("getPortfolioValueHistoryForAssets yieldedEnd :", yieldedEnd);
          yield {
            ...(lastValue ?? value),
            assetId: "SYNTH",
            recordedAt: queryEndDate,
          };
          yieldedEnd = true;
        }
        break;
      }

      // If matches end, yield and finish
      if (
        queryEndDate &&
        value.recordedAt.getUTCFullYear() === queryEndDate.getUTCFullYear() &&
        value.recordedAt.getUTCMonth() === queryEndDate.getUTCMonth() &&
        value.recordedAt.getUTCDate() === queryEndDate.getUTCDate()
      ) {
        yield value;
        yieldedEnd = true;
        break;
      }

      // Otherwise, yield value if within range
      if (
        (!queryStartDate || value.recordedAt >= queryStartDate) &&
        (!queryEndDate || value.recordedAt <= queryEndDate)
      ) {
        yield value;
      }
      lastValue = value;
      next = await assetValues.next();
    }

    // If we never yielded an end value and queryEndDate is set, yield synthetic end
    if (queryEndDate && !yieldedEnd && lastValue) {
      yield {
        ...lastValue,
        assetId: "SYNTH",
        recordedAt: queryEndDate,
      };
    }
  };
}

// const b = (query?: DataRangeQuery): (assetValues: Iterable<PossibleDummyAssetValue>) => Iterable<PossibleDummyAssetValue> => {
//   const assetValues: PossibleDummyAssetValue[] = [{
//     //Add syntjetic start value
//   }];
//   const queryStartDate = resolveDate(query?.start)
//   const queryEndDate = resolveDate(query?.end)

//   function *f(a:Iterable<PossibleDummyAssetValue>) {
//     for (const value of a) {
//       //on receiving the first asset value, if it matches the queryStartDate, we replace the synthtic start value with the actual value
//       //On recieving the asset values we check if they fit in the date ramge and yeild if they do.
//       //We continue to yeild the incoming values that are within the date range.
//       //IF an asset value comes in those date is a match to the query end date we yeild and finish.
//       //If an assets value comes in that is after the query end date we replace with a synthetic end value and finish.
//       //When the iterable has finished

//     }
//     //At the end of the  loop we check if there are assets in the array that match precisely the queryStartDate and queryEndDate

//   }
// }

// const c = b({
//   start: new Date("2025-01-01"),
//   end: new Date("2025-01-02"),
// })(mergeSortedAssetHistories([]))

// for (const value of c) {
//   console.log(value);
// }

/**
 * Merges multiple sorted asset histories into a single globally ordered stream.
 * This implementation advances each iterator until all buffered values are at or after the agreed latest date,
 * then yields all values with that date (sorted by assetId if needed).
 * This ensures no value is yielded until it is certain that no earlier value remains in any iterator.
 *
 * @param assets Iterable of AssetWithHistory (each history must be sorted by recordedAt)
 * @yields AssetValue objects in strict global order by recordedAt (and assetId for tie-breaks)
 */
export async function* mergeSortedAssetHistories(
  assets: Iterable<AssetWithValueHistoryAsyncIterators>
): AsyncGenerator<AssetValue> {
  const iterators: AsyncIterator<AssetValue>[] = [];
  const buffer: Array<IteratorResult<AssetValue> | undefined> = [];

  for (const asset of assets) {
    iterators.push(asset.history);
    buffer.push(await asset.history.next());
  }

  while (true) {
    if (!buffer || buffer.length === 0) break;
    // Step 1: Find the minimum date among all buffered values
    let minDate: Date | null = null;
    for (const next of buffer) {
      if (next !== undefined && !next.done) {
        if (!minDate || next.value.recordedAt < minDate) {
          minDate = next.value.recordedAt;
        }
      }
    }
    if (!minDate) break; // All iterators done

    // Step 2: Advance any iterator whose value is before minDate
    let advanced = false;
    for (let i = 0; i < buffer.length; i++) {
      let buf = buffer[i];
      if (!minDate) break;
      while (
        buf !== undefined &&
        !buf.done &&
        buf.value &&
        buf.value.recordedAt < minDate
      ) {
        if (iterators[i] === undefined) break;
        buffer[i] = await iterators[i]!.next();
        buf = buffer[i];
        advanced = true;
      }
    }
    if (advanced) continue; // Re-evaluate minDate after advancing

    // Step 3: Yield all values with minDate (sorted if needed)
    const toYield: { value: AssetValue; idx: number }[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const buf = buffer[i];
      if (
        buf &&
        !buf.done &&
        buf.value.recordedAt.getTime() === minDate.getTime()
      ) {
        toYield.push({ value: buf.value, idx: i });
      }
    }
    toYield.sort((a, b) => a.value.assetId.localeCompare(b.value.assetId));
    for (const { value, idx } of toYield) {
      yield value;
      if (iterators[idx]) {
        buffer[idx] = await iterators[idx]!.next();
      }
    }
  }
}

export const resolveAssetWithChangeForDateRange = <T extends AssetWithHistory>(
  asset: T,
  query?: DataRangeQuery
): WithAccountChange<T> => {
  const startDate = resolveDate(query?.start);
  const endDate = resolveDate(query?.end);

  const assetValuesForRange = defineAssetValuesForDateRange(asset.history, {
    start: startDate,
    end: endDate,
  });
  return {
    ...asset,
    accountChange: calculateAssetsChange(assetValuesForRange),
  };
};

export const resolveAssetsWithChange = <T extends AssetWithHistory>(
  assets: T[],
  query?: DataRangeQuery
): WithAccountChange<T>[] => {
  const startDate = resolveDate(query?.start);
  const endDate = resolveDate(query?.end);

  return assets.map((asset) =>
    resolveAssetWithChangeForDateRange(asset, {
      start: startDate,
      end: endDate,
    })
  );
};

/**
 * Aggregates all asset histories into a portfolio-level time series for a given date range.
 *
 * Uses the mergeSortedAssetHistories generator for memory-efficient, streaming processing of large data sets.
 * This avoids flattening all asset histories into a single array, making it suitable for large portfolios.
 *
 * @param assets Array of AssetWithHistory
 * @param query Optional date range
 * @returns Array of PortfolioHistoryTimePoint objects, sorted by date
 */
export const getPortfolioValueHistoryForAssets = async <T extends AssetWithHistory>(
  assets: Iterable<T>,
  query?: DataRangeQuery
): Promise<PortfolioHistoryTimePoint[]> => {
  console.log(
    "getPortfolioValueHistoryForAssets assets :",
    JSON.stringify(assets, null, 2)
  );

  // Create a map to track the latest known value for each account
  const accountLatestValues = new Map<string, number>();

  // Create a map to store portfolio values and changes at each timestamp
  const portfolioValues = new Map<
    string,
    {
      value: number;
      changes: {
        assetId: UserAsset["id"];
        previousValue: number;
        newValue: number;
        change: number;
      }[];
    }
  >();

  const assetsWithHistoryAsyncIterators = Array.from(assets, (asset) => ({
    ...asset,
    history: arrayToAsyncIterator(asset.history),
  }));

  const stream = streamAssetValuesForDateRange(query)(
    mergeSortedAssetHistories(assetsWithHistoryAsyncIterators)
  );

  for await (const entry of stream) {
    //console.log("getPortfolioValueHistoryForAssets entry :", entry);

    const previousValue = accountLatestValues.get(entry.assetId) || 0;
    const newValue = Number(entry.value);
    const change = newValue - previousValue;

    //console.log("getPortfolioValueHistoryForAssets previousValue :", previousValue);
    //console.log("getPortfolioValueHistoryForAssets newValue :", newValue);
    //console.log("getPortfolioValueHistoryForAssets change :", change);

    // Update the latest known value for this account
    accountLatestValues.set(entry.assetId, newValue);

    // Calculate total portfolio value at this point in time
    const totalValue = Array.from(accountLatestValues.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    //console.log("getPortfolioValueHistoryForAssets totalValue :", totalValue);

    // Format the date to YYYY-MM-DD for consistent daily grouping
    const dateKey = entry.recordedAt.toISOString().split("T")[0];

    if (!dateKey) continue;

    // If we already have an entry for this date, update it with the new changes
    if (portfolioValues.has(dateKey)) {
      //console.log("getPortfolioValueHistoryForAssets dateKey exists :", dateKey);
      const existingEntry = portfolioValues.get(dateKey)!;
      existingEntry.value = totalValue;
      existingEntry.changes.push({
        assetId: entry.assetId,
        previousValue,
        newValue,
        change,
      });
    } else {
      //console.log("getPortfolioValueHistoryForAssets dateKey does not exist :", dateKey);
      // Otherwise create a new entry for this date
      portfolioValues.set(dateKey, {
        value: totalValue,
        changes: [
          {
            assetId: entry.assetId,
            previousValue,
            newValue,
            change,
          },
        ],
      });
    }
  }

  return Array.from(portfolioValues.entries())
    .map(([timestamp, data]) => ({
      date: new Date(timestamp),
      value: data.value,
      changes: data.changes,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const getPortfolioOverviewForAssets = async <T extends AssetWithHistory>(
  assets: T[],
  query?: DataRangeQuery
): Promise<AssetsChange> => {
  const assetsWithValueChanges: WithAccountChange<T[][number]>[] =
    await Promise.all(
      assets.map(async (asset) => {
        return resolveAssetWithChangeForDateRange(asset, query);
      })
    );

  const assetsValueChanges: AssetsChange = assetsWithValueChanges
    .map((asset) => asset.accountChange)
    .reduce(
      (acc: AssetsChange, asset) => {
        const startDate: Date | null =
          asset.startDate && acc.startDate
            ? asset.startDate < acc.startDate
              ? asset.startDate
              : acc.startDate
            : null;
        const endDate: Date | null =
          asset.endDate && acc.endDate
            ? asset.endDate > acc.endDate
              ? asset.endDate
              : acc.endDate
            : null;
        const startValue =
          asset.startDate && acc.startDate
            ? asset.startDate < acc.startDate
              ? asset.startValue
              : asset.startDate > acc.startDate
              ? acc.startValue
              : asset.startDate === acc.startDate
              ? acc.startValue + asset.startValue
              : acc.startValue
            : 0;

        const value = acc.value + asset.value;
        const currencyChange = value - startValue;

        const percentageChange = normalisePercentage(startValue, value);

        return {
          startDate,
          endDate,
          startValue,
          value,
          currentChange: currencyChange,
          currentChangePercentage: percentageChange,
        };
      },
      {
        startDate: resolveDate(query?.start) ?? new Date(),
        endDate: resolveDate(query?.end) ?? new Date(),
        startValue: 0,
        value: 0,
        currentChange: 0,
        currentChangePercentage: 0,
      }
    );

  return assetsValueChanges;
};
