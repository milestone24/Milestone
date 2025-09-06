import {
  UserAsset,
  AssetsChange,
  AssetValue,
  AssetWithHistory,
  AssetWithValueHistoryAsyncIterators,
  DataRangeQuery,
  PossibleDummyAssetValue,
  WithAccountChange,
  AssetHistoryTimePoint,
  WithAssetHistory,
  UserAssetWithHistoryAndAccountChange,
  CombinedDayValues,
  CombinedDayValuesChange,
} from "@shared/schema";
import { arrayToAsyncIterator } from "./async";
import { QueryParams } from "@server/utils/resource-query-builder";

export const dateRangeToQueryFilter = (
  query?: DataRangeQuery
): QueryParams["filter"] => {
  return {
    filter: {
      start: {
        eq: query?.start,
      },
      end: {
        eq: query?.end,
      },
    },
  };
};

export const queryParamsFilterToDateRange = (
  filter: QueryParams["filter"] | undefined
): DataRangeQuery => {
  return {
    start: resolveDate(
      /*@ts-ignore*/
      filter?.start?.eq ?? undefined
    ),
    end: resolveDate(
      /*@ts-ignore*/
      filter?.end?.eq ?? undefined
    ),
  };
};

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
    (a, b) => a.valueDate.getTime() - b.valueDate.getTime()
  );
  return indexes.map((index) => sorted.at(index) ?? null);
};

export const normalisePercentage = (
  valueOne: number,
  valueTwo: number
): number => {
  return valueOne === 0
    ? valueTwo > 0
      ? 100
      : 0
    : ((valueTwo - valueOne) / valueTwo) * 100;
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

  return firstAssetValue
    ? lastAssetValue
      ? ((percentageChange = normalisePercentage(
          firstAssetValue.value,
          lastAssetValue.value
        )),
        {
          startDate: firstAssetValue.valueDate,
          endDate: lastAssetValue.valueDate,
          startValue: firstAssetValue.value,
          value: lastAssetValue.value,
          currentChange: lastAssetValue.value - firstAssetValue.value,
          currentChangePercentage: percentageChange,
        })
      : {
          startDate: firstAssetValue.valueDate,
          endDate: firstAssetValue.valueDate,
          startValue: firstAssetValue.value,
          value: firstAssetValue.value,
          currentChange: firstAssetValue.value - firstAssetValue.value,
          currentChangePercentage: percentageChange,
        }
    : {
        startDate: new Date(),
        endDate: new Date(),
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
  const assetValuesSorted = assetValues.toSorted(
    (a, b) => a.valueDate.getTime() - b.valueDate.getTime()
  );

  const queryStartDate = resolveDate(query?.start);
  const queryEndDate = resolveDate(query?.end);

  const withStartPoint: (values: AssetValue[]) => PossibleDummyAssetValue[] =
    queryStartDate
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
              assetValue.valueDate.getUTCFullYear() ===
                queryStartDate.getUTCFullYear() &&
              assetValue.valueDate.getUTCMonth() ===
                queryStartDate.getUTCMonth() &&
              assetValue.valueDate.getUTCDate() === queryStartDate.getUTCDate()
          );
          const lastValueIndexBeforeQueryStartDate = values.findLastIndex(
            (assetValue) => assetValue.valueDate < queryStartDate
          );
          const lastValueBeforeQueryStartDate =
            values[lastValueIndexBeforeQueryStartDate];

          const addStartPoint = (
            assetValue: Omit<PossibleDummyAssetValue, "recordedAt">,
            slicePoint: number
          ): PossibleDummyAssetValue[] => [
            {
              ...assetValue,
              id: null,
              valueDate: queryStartDate,
              valueType: "synthetic",
            },
            ...values.slice(slicePoint).map(
              (value): PossibleDummyAssetValue => ({
                ...value,
                valueType: "asset",
              })
            ),
          ];

          return valueIndexForQueryStartDate > -1
            ? values.slice(valueIndexForQueryStartDate).map(
                (value): PossibleDummyAssetValue => ({
                  ...value,
                  valueType: "asset",
                })
              )
            : lastValueBeforeQueryStartDate
            ? addStartPoint(
                { ...lastValueBeforeQueryStartDate, valueType: "synthetic" },
                lastValueIndexBeforeQueryStartDate + 1
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
                  metadata: null,
                  valueType: "synthetic",
                },
                lastValueIndexBeforeQueryStartDate + 1
              );
        }
      : (values) => {
          return values.slice().map(
            (value): PossibleDummyAssetValue => ({
              ...value,
              valueType: "asset",
            })
          );
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
        const valueIndexForQueryEndDate = values.findLastIndex(
          (assetValue) =>
            assetValue.valueDate.getUTCFullYear() ===
              queryEndDate.getUTCFullYear() &&
            assetValue.valueDate.getUTCMonth() === queryEndDate.getUTCMonth() &&
            assetValue.valueDate.getUTCDate() === queryEndDate.getUTCDate()
        );

        const lastValueIndexBeforeOrEqualToQueryEndDate = values.findLastIndex(
          (assetValue) => assetValue.valueDate <= queryEndDate
        );

        const lastValueBeforeOrEqualToQueryEndDate =
          values[lastValueIndexBeforeOrEqualToQueryEndDate];

        const addEndPoint = (
          assetValue: PossibleDummyAssetValue,
          slicePoint: number
        ) => [
          ...values.slice(0, slicePoint),
          {
            ...assetValue,
            valueDate: queryEndDate,
          },
        ];

        return valueIndexForQueryEndDate > 1
          ? values.slice(0, valueIndexForQueryEndDate + 1)
          : lastValueBeforeOrEqualToQueryEndDate
          ? addEndPoint(
              lastValueBeforeOrEqualToQueryEndDate,
              lastValueIndexBeforeOrEqualToQueryEndDate + 1
            )
          : addEndPoint(
              {
                id: null,
                value: 0,
                assetId: values[0]?.assetId ?? "",
                createdAt: queryEndDate,
                updatedAt: queryEndDate,
                valueDate: queryEndDate,
                entryMethod: "manual",
                metadata: null,
                valueType: "synthetic",
              },
              valueIndexForQueryEndDate
            );
      }
    : (values) => {
        return values.slice();
      };

  return withEndPoint(withStartPoint(assetValuesSorted)).sort(
    (a, b) => a.valueDate.getTime() - b.valueDate.getTime()
  );
};

/**
 * Async factory function that returns a streaming, range-aware async generator for asset values.
 *
 * This function enables memory-efficient, single-pass processing of large, sorted async streams of asset values.
 * It yields all values within the specified date range, and inserts synthetic start/end values if needed.
 * Only minimal state is buffered (last value before start, last value seen, etc.).
 *
 * Input must be an async generator (or async iterator) yielding asset values in ascending order by valueDate.
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
    assetValues: AsyncIterator<AssetValue>
    //boundaries: Boundaries
  ): AsyncGenerator<PossibleDummyAssetValue> {
    const queryStartDate = resolveDate(query?.start);
    const queryEndDate = resolveDate(query?.end);
    //let lastBeforeStart: PossibleDummyAssetValue | null = null;

    //Should this be a weak map
    const valuesBeforeStart: Map<string, AssetValue> = new Map();

    let yieldedStart = false;
    let yieldedEnd = false;
    let lastValue: AssetValue | null = null;

    let next = await assetValues.next();
    while (!next.done) {
      const value = next.value;

      // Track last value before start
      // Keep continuing to the next value until we find a value that is after the query start date
      if (queryStartDate && value.valueDate < queryStartDate) {
        //lastBeforeStart = value;
        valuesBeforeStart.set(value.assetId, value);
        lastValue = value;
        next = await assetValues.next();
        continue;
      }

      //Now we are in the realm of values that are after the query start date

      // Handle synthetic start
      if (queryStartDate && !yieldedStart) {
        for (const value of valuesBeforeStart.values()) {
          yield {
            ...value,
            id: null,
            valueDate: queryStartDate,
            valueType: "synthetic",
          };
        }

        if (
          value.valueDate.getUTCFullYear() ===
            queryStartDate.getUTCFullYear() &&
          value.valueDate.getUTCMonth() === queryStartDate.getUTCMonth() &&
          value.valueDate.getUTCDate() === queryStartDate.getUTCDate()
        ) {
          yield {
            ...value,
            valueType: "asset",
          };
        } else {
          if (valuesBeforeStart.size < 1) {
            yield {
              id: null,
              value: 0,
              assetId: null,
              valueType: "synthetic",
              createdAt: queryStartDate,
              updatedAt: queryStartDate,
              valueDate: queryStartDate,
              entryMethod: "calculated",
              metadata: null,
            };
          }

          // const before =
          //   lastBeforeStart ?? boundaries.get(value.assetId)?.before;
          // // Insert synthetic start value
          // yield before
          //   ? {
          //       id: null,
          //       value: before.value ?? 0,
          //       assetId: before.assetId,
          //       createdAt: queryStartDate,
          //       updatedAt: queryStartDate,
          //       valueDate: queryStartDate,
          //       entryMethod: before.entryMethod,
          //       metadata: before.metadata,
          //     }
          //   : {
          //       id: null,
          //       value: 0,
          //       assetId: value.assetId, //This is wrong
          //       createdAt: queryStartDate,
          //       updatedAt: queryStartDate,
          //       valueDate: queryStartDate,
          //       entryMethod: "manual", //This is wrong should be synthetic
          //       metadata: null,
          //     };
          // Then yield current value if within range
          if (!queryEndDate || value.valueDate <= queryEndDate) {
            yield {
              ...value,
              valueType: "asset",
            };
          }
        }
        yieldedStart = true;
        lastValue = value;
        next = await assetValues.next();
        continue;
      }

      // If after end, yield synthetic end and finish
      if (queryEndDate && value.valueDate > queryEndDate) {
        if (!yieldedEnd) {
          yield {
            ...(lastValue ?? value),
            id: null,
            valueDate: queryEndDate,
            valueType: "synthetic",
          };
          yieldedEnd = true;
        }
        break;
      }

      // If matches end, yield and finish
      if (
        queryEndDate &&
        value.valueDate.getUTCFullYear() === queryEndDate.getUTCFullYear() &&
        value.valueDate.getUTCMonth() === queryEndDate.getUTCMonth() &&
        value.valueDate.getUTCDate() === queryEndDate.getUTCDate()
      ) {
        yield {
          ...value,
          valueType: "asset",
        };
        yieldedEnd = true;
        break;
      }

      // Otherwise, yield value if within range
      if (
        (!queryStartDate || value.valueDate >= queryStartDate) &&
        (!queryEndDate || value.valueDate <= queryEndDate)
      ) {
        yield {
          ...value,
          valueType: "asset",
        };
      }
      lastValue = value;
      next = await assetValues.next();
    }

    // If we never yielded an end value and queryEndDate is set, yield synthetic end
    if (queryEndDate && !yieldedEnd && lastValue) {
      yield {
        ...lastValue,
        id: null,
        valueType: "synthetic",
        valueDate: queryEndDate,
      };
    }
  };
}

/**
 * Merges multiple sorted asset histories into a single globally ordered stream.
 * This implementation advances each iterator until all buffered values are at or after the agreed latest date,
 * then yields all values with that date (sorted by assetId if needed).
 * This ensures no value is yielded until it is certain that no earlier value remains in any iterator.
 *
 * @param assets Iterable of AssetWithHistory (each history must be sorted by valueDate)
 * @yields AssetValue objects in strict global order by valueDate (and assetId for tie-breaks)
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
        if (!minDate || next.value.valueDate < minDate) {
          minDate = next.value.valueDate;
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
        buf.value.valueDate < minDate
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
        buf.value.valueDate.getTime() === minDate.getTime()
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

  if (asset.valueMethod === "manual") {
    console.log("assetValuesForRange", assetValuesForRange);
  }

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

export const resolveDayValueHistoryForAssetForDateRange = async (
  asset: WithAssetHistory<UserAsset>,
  query?: DataRangeQuery
): Promise<AssetHistoryTimePoint[]> => {
  const asyncIterator = {
    ...asset,
    history: arrayToAsyncIterator(asset.history),
  };

  const stream = streamAssetValuesForDateRange(query)(
    mergeSortedAssetHistories([asyncIterator])
  );

  return getCombinedDayValuesForValues(stream);
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
export const resolveDayValueHistoryForAssetsForDateRange = async <
  T extends WithAssetHistory<UserAsset>
>(
  assets: Iterable<T>,
  query?: DataRangeQuery
): Promise<AssetHistoryTimePoint[]> => {
  const assetsWithHistoryAsyncIterators = Array.from(assets, (asset) => ({
    ...asset,
    history: arrayToAsyncIterator(asset.history),
  }));

  const stream = streamAssetValuesForDateRange(query)(
    mergeSortedAssetHistories(assetsWithHistoryAsyncIterators)
  );

  return getCombinedDayValuesForValues(stream);
};

export const getCombinedDayValuesForValues = async (
  stream: AsyncGenerator<PossibleDummyAssetValue>
): Promise<AssetHistoryTimePoint[]> => {
  // Create a map to track the latest known value for each account
  const accountLatestValues = new Map<string, number>();

  // Create a map to store portfolio values and changes at each timestamp
  const portfolioValues = new Map<string, CombinedDayValues>();

  const addPortfolioValue = (
    dateKey: string,
    entry: PossibleDummyAssetValue,
    totalValue: number
  ) => {
    const change: CombinedDayValuesChange | null =
      entry.valueType === "asset"
        ? (() => {
            const previousValue = accountLatestValues.get(entry.assetId) || 0;
            const newValue = Number(entry.value);
            const change = newValue - previousValue;
            return {
              assetId: entry.assetId,
              previousValue,
              newValue,
              change,
            };
          })()
        : null;
    // If we already have an entry for this date, update it with the new changes
    if (portfolioValues.has(dateKey)) {
      const existingEntry = portfolioValues.get(dateKey)!;
      existingEntry.value = totalValue;
      if (change) {
        existingEntry.changes.push(change);
      }
      if (entry.metadata) {
        existingEntry.metadata.push(entry.metadata);
      }
    } else {
      // Otherwise create a new entry for this date
      portfolioValues.set(dateKey, {
        value: totalValue,
        changes: change ? [change] : [],
        metadata: entry.metadata ? [entry.metadata] : [],
      });
    }
  };

  for await (const entry of stream) {
    // Format the date to YYYY-MM-DD for consistent daily grouping
    const dateKey = entry.valueDate.toISOString().split("T")[0]!;

    if (!dateKey) continue;

    const value = entry.value ?? 0;

    const change: CombinedDayValuesChange | null =
      entry.valueType === "asset"
        ? ((): CombinedDayValuesChange => {
            const previousValue = entry.assetId
              ? accountLatestValues.get(entry.assetId) || 0
              : 0;
            const change = value - previousValue;
            return {
              assetId: entry.assetId,
              previousValue,
              newValue: value,
              change,
            };
          })()
        : null;

    if (entry.assetId) {
      accountLatestValues.set(entry.assetId, value);
    }

    // Calculate total portfolio value at this point in time
    const totalValue = Array.from(accountLatestValues.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    // If we already have an entry for this date, update it with the new changes
    if (portfolioValues.has(dateKey)) {
      const existingEntry = portfolioValues.get(dateKey)!;
      existingEntry.value = totalValue;
      if (entry.assetId && change) {
        existingEntry.changes.push(change);
      }
      if (entry.metadata) {
        existingEntry.metadata.push(entry.metadata);
      }
    } else {
      // Otherwise create a new entry for this date
      portfolioValues.set(dateKey, {
        value: totalValue,
        changes: change ? [change] : [],
        metadata: entry.metadata ? [entry.metadata] : [],
      });
    }
  }

  return Array.from(portfolioValues.entries())
    .map(([timestamp, data]) => ({
      date: new Date(timestamp),
      value: data.value,
      changes: data.changes,
      metadata: data.metadata,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const getPortfolioOverviewForAssets = async (
  assets: UserAssetWithHistoryAndAccountChange[]
): Promise<AssetsChange> => {
  const assetsValueChanges: AssetsChange = assets
    .map((asset) => asset.accountChange)
    .reduce((acc: AssetsChange, asset) => {
      const startDate: Date =
        asset.startDate < acc.startDate ? asset.startDate : acc.startDate;

      const endDate: Date =
        asset.endDate > acc.endDate ? asset.endDate : acc.endDate;

      const startValue =
        asset.startDate === acc.startDate
          ? acc.startValue + asset.startValue
          : asset.startDate < acc.startDate
          ? asset.startValue
          : asset.startDate > acc.startDate
          ? acc.startValue
          : acc.startValue;

      const value = acc.value + asset.value;
      const currentChange = acc.currentChange + asset.currentChange;

      const percentageChange = normalisePercentage(startValue, value);

      return {
        startDate,
        endDate,
        startValue,
        value,
        currentChange,
        currentChangePercentage: percentageChange,
      };
    });

  return assetsValueChanges;
};
