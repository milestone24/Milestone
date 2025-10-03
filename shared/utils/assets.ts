import {
  UserAsset,
  AssetsChange,
  AssetValue,
  DataRangeQuery,
  PossibleDummyAssetValue,
  WithAccountChange,
  AssetValueTimePoint,
  WithAssetHistory,
  UserAssetWithHistoryAndAccountChange,
  CombinedDayValuesChange,
  BrandedAssetValue,
  TransactionTimePoint,
  PossibleDummyAssetTransactionValue,
  AssetHistoryValueBase,
  PossibleDummyHistoryValue,
  CombinedDayTimePointBase,
  BrandedAbstractTransactionValue,
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
              valueType: assetValue.valueType,
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
                assetId: null,
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
export function streamAssetValuesForDateRange<
  I extends { id: string; value: number; valueDate: Date; assetId: string }
>(
  //<
  // I,
  // B extends I extends { value: number; valueDate: Date; assetId: string }
  //   ? I
  //   : never = I extends { value: number; valueDate: Date; assetId: string }
  //   ? I
  //   : never,
  // R extends B extends never
  //   ? never
  //   : PossibleDummyHistoryValue<B> = B extends never
  //   ? never
  //   : PossibleDummyHistoryValue<B>
  //>
  query?: DataRangeQuery,
  valueKey?: keyof I
) {
  //type R = B extends never ? never : PossibleDummyHistoryValue<B>;
  //Do not delete this comment it is for reference to allow flexibility later
  // return async function* (assetValues: AsyncGenerator<PossibleDummyAssetValue, void, unknown> | AsyncIterator<PossibleDummyAssetValue>): AsyncGenerator<PossibleDummyAssetValue> {
  return async function* (
    assetValues: AsyncIterator<I>
    // boundaryResolver: BoundaryResolver<
    //   PossibleDummyHistoryValue<I>,
    //   I
    // >,
    // valueResolver?: ValueResolver<I>
    // //boundaries: Boundaries
  ): AsyncGenerator<PossibleDummyHistoryValue<I>> {
    const queryStartDate = resolveDate(query?.start);
    const queryEndDate = resolveDate(query?.end);

    //Should this be a weak map
    const valuesBeforeStart: Map<string, I> = new Map();

    let yieldedStart = false;
    let yieldedEnd = false;
    let lastValue: I | null = null;

    let next = await assetValues.next();

    const getValue = (value: I): number =>
      valueKey ? (value[valueKey] as number) : value.value;

    while (!next.done) {
      const value = next.value;
      console.log("value :", value);

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
            assetId: value.assetId,
            value: getValue(value),
            valueType: "synthetic-asset",
            valueDate: queryStartDate,
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
            value: getValue(value),
            valueType: "asset",
            id: value.id ?? null,
            valueDate: queryStartDate,
          };
        } else {
          if (valuesBeforeStart.size < 1) {
            yield {
              valueType: "synthetic",
              id: null,
              assetId: null,
              value: 0,
              valueDate: queryStartDate,
            };
          }
          // Then yield current value if within range
          if (!queryEndDate || value.valueDate <= queryEndDate) {
            yield {
              ...value,
              value: getValue(value),
              valueType: "asset",
              id: value.id ?? null,
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
            value: getValue(lastValue ?? value),
            valueType: "synthetic-asset",
            valueDate: queryEndDate,
            id: null,
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
          value: getValue(value),
          valueType: "asset",
          id: value.id ?? null,
          valueDate: queryEndDate,
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
          value: getValue(value),
          valueType: "asset",
          id: value.id ?? null,
          valueDate: value.valueDate,
        };
      }
      lastValue = value;
      next = await assetValues.next();
    }

    //If a start date was defined we always need to yield a start value
    if (queryStartDate && !yieldedStart) {
      if (valuesBeforeStart.size > 0) {
        for (const value of valuesBeforeStart.values()) {
          yield {
            ...value,
            id: null,
            assetId: value.assetId,
            value: getValue(value),
            valueType: "synthetic-asset",
            valueDate: queryStartDate,
          };
        }
      } else {
        yield {
          valueType: "synthetic",
          id: null,
          assetId: null,
          value: 0,
          valueDate: queryStartDate,
        };
      }
    }

    // If we never yielded an end value and queryEndDate is set, yield synthetic end
    if (queryEndDate && !yieldedEnd && lastValue) {
      yield {
        ...lastValue,
        value: getValue(lastValue),
        valueType: "synthetic-asset",
        id: null,
        assetId: null,
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
export async function* mergeSortedAssetHistories<
  I extends { valueDate: Date; value: number; assetId: string }
>(
  assets: Iterable<{
    history: AsyncIterator<I>;
  }>
): AsyncGenerator<I> {
  const iterators: AsyncIterator<I>[] = [];
  const buffer: Array<IteratorResult<I> | undefined> = [];

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
    const toYield: { value: I; idx: number }[] = [];
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

export const resolveAssetWithChangeForDateRange = <
  T extends WithAssetHistory<UserAsset, AssetValue>
>(
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

/**
 * @deprecated Use resolveDayValueHistoryForAssetsForDateRange instead
 */
export const resolveAssetsWithChange = <
  T extends WithAssetHistory<UserAsset, AssetValue>
>(
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

type DayResolverParams<T, E> = {
  day: T;
  entry: E;
};
type DayResolver<T, E> = (params: DayResolverParams<T, E>) => T;

/**
 * This should now producs the final data for the graph (Chart Data)
 *
 * This should support varios period points, for example daily, weekly, monthly, yearly, etc.
 */
export const getCombinedDayValuesForValues = async <
  I extends PossibleDummyHistoryValue<AssetHistoryValueBase>,
  D extends CombinedDayTimePointBase,
  DD extends D extends CombinedDayTimePointBase
    ? Omit<D, "valueDate">
    : never = D extends CombinedDayTimePointBase ? Omit<D, "valueDate"> : never
>(
  //stream: AsyncGenerator<C>
  stream: AsyncGenerator<I>,
  resolver: DayResolver<DD, I>
): Promise<D[]> => {
  // Create a map to track the latest known value for each account
  const accountLatestValues = new Map<string, number>();

  // Create a map to store portfolio values and changes at each timestamp
  const portfolioValues = new Map<string, DD>();

  for await (const entry of stream) {
    // Format the date to YYYY-MM-DD for consistent daily grouping
    const dateKey = entry.valueDate.toISOString().split("T")[0]!;

    if (!dateKey) continue;

    const value = entry.value ?? 0;

    // const change: CombinedDayValuesChange | null =
    //   entry.valueType === "asset"
    //     ? ((): CombinedDayValuesChange => {
    //         const previousValue = entry.assetId
    //           ? accountLatestValues.get(entry.assetId) || 0
    //           : 0;
    //         const change = value - previousValue;
    //         return {
    //           assetId: entry.assetId,
    //           previousValue,
    //           newValue: value,
    //           change,
    //         };
    //       })()
    //     : null;

    const change: CombinedDayValuesChange | null =
      ((): CombinedDayValuesChange => {
        // const previousValue = entry.assetId
        //   ? accountLatestValues.get(entry.assetId) || 0
        //   : 0;
        const previousValue =
          accountLatestValues.get(entry.assetId ?? "synthetic") || 0;

        //for transactions
        // const newValue = value + previousValue;
        // const change = newValue - previousValue;

        const change = value - previousValue;
        const newValue = value;
        return {
          ...(entry.assetId
            ? {
                assetId: entry.assetId,
                valueType: entry.valueType,
              }
            : {
                assetId: null,
                valueType: "synthetic",
              }),
          previousValue,

          //for transactions
          newValue: newValue,
          //newValue: value,
          change,
        };
      })();

    // if (entry.assetId) {
    //   accountLatestValues.set(entry.assetId, value);
    // }

    accountLatestValues.set(
      entry.valueType === "synthetic" ? "synthetic" : entry.assetId,
      value
    );

    // Calculate total portfolio value at this point in time
    const totalValue = Array.from(accountLatestValues.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    // If we already have an entry for this date, update it with the new changes
    if (portfolioValues.has(dateKey)) {
      const existingEntry = portfolioValues.get(dateKey)!;
      const resolvedEntry = resolver({
        day: {
          ...existingEntry,
          value: totalValue,
          changes: [...existingEntry.changes, change],
        },
        entry,
      });
      portfolioValues.set(dateKey, resolvedEntry);
      //To be added by injected function
      // if (entry.metadata) {
      //   existingEntry.metadata.push(entry.metadata);
      // }
    } else {
      // Otherwise create a new entry for this date
      //TODO We need to fix this, we should not have to dangerous cast
      const resolvedEntry = resolver({
        day: {
          value: totalValue,
          changes: change ? [change] : [],
        } as DD,
        entry,
      });
      portfolioValues.set(dateKey, resolvedEntry);
    }
  }

  //TODO We need to fix this, we should not have to dangerous cast
  //Why is the type safety not working here?
  const mapped: D[] = Array.from(portfolioValues.entries())
    .map(
      ([timestamp, data]) =>
        ({
          valueDate: new Date(timestamp),
          ...data,
        } as unknown as D)
    )
    .sort((a, b) => a.valueDate.getTime() - b.valueDate.getTime());

  return mapped;
};

export const resolveDayValueHistoryForAssetForDateRange = async (
  asset: WithAssetHistory<UserAsset, BrandedAssetValue>,
  query?: DataRangeQuery
): Promise<AssetValueTimePoint[]> => {
  const asyncIterator = {
    ...asset,
    history: arrayToAsyncIterator(asset.history),
  };

  const stream = streamAssetValuesForDateRange<BrandedAssetValue>(query)(
    mergeSortedAssetHistories<BrandedAssetValue>([asyncIterator])
  );

  return getCombinedDayValuesForValues<
    PossibleDummyAssetValue,
    AssetValueTimePoint
  >(stream, ({ day, entry }) => {
    return {
      ...day,
      metadata: entry.metadata
        ? day.metadata
          ? [...day.metadata, entry.metadata]
          : [entry.metadata]
        : day.metadata,
    };
  });
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
  T extends WithAssetHistory<UserAsset, BrandedAssetValue>
>(
  assets: Iterable<T>,
  query?: DataRangeQuery
): Promise<AssetValueTimePoint[]> => {
  const assetsWithHistoryAsyncIterators = Array.from(assets, (asset) => ({
    ...asset,
    history: arrayToAsyncIterator(asset.history),
  }));

  const stream = streamAssetValuesForDateRange<BrandedAssetValue>(query)(
    mergeSortedAssetHistories<BrandedAssetValue>(
      assetsWithHistoryAsyncIterators
    )
  );

  return getCombinedDayValuesForValues<
    PossibleDummyHistoryValue<BrandedAssetValue>,
    AssetValueTimePoint
  >(stream, ({ day, entry }) => {
    return {
      ...day,
      metadata: entry.metadata
        ? day.metadata
          ? [...day.metadata, entry.metadata]
          : [entry.metadata]
        : day.metadata,
    };
  });
};

export const resolveDayTransactionHistoryForAssetsForDateRange = async (
  assets: Iterable<
    WithAssetHistory<UserAsset, BrandedAbstractTransactionValue>
  >,
  query?: DataRangeQuery
): Promise<TransactionTimePoint[]> => {
  const assetsWithHistoryAsyncIterators = Array.from(assets, (asset) => ({
    ...asset,
    history: arrayToAsyncIterator(asset.history),
  }));

  const stream = streamAssetValuesForDateRange<BrandedAbstractTransactionValue>(
    query,
    "accumulativeAssetCurrencyValue"
  )(
    mergeSortedAssetHistories<BrandedAbstractTransactionValue>(
      assetsWithHistoryAsyncIterators
    )
  );

  const combined = await getCombinedDayValuesForValues<
    PossibleDummyHistoryValue<BrandedAbstractTransactionValue>,
    TransactionTimePoint
  >(stream, ({ day, entry }) => {
    return {
      ...day,
      transactions: [...(day.transactions ?? []), entry],
    };
  });

  return combined;
};

export const getPortfolioOverviewForAssets = async (
  assets: UserAssetWithHistoryAndAccountChange[]
): Promise<AssetsChange> => {

  const assetsValueChanges: AssetsChange =
    assets.length > 0
      ? assets
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
          })
      : {
          startDate: new Date(),
          endDate: new Date(),
          startValue: 0,
          value: 0,
          currentChange: 0,
          currentChangePercentage: 0,
        };

  return assetsValueChanges;
};
