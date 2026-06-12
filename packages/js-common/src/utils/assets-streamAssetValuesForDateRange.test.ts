import { describe, it, expect } from "vitest";
import {
  streamAssetValuesForDateRange,
  mergeSortedAssetHistories,
  getCombinedDayValuesForValues,
} from "./assets";
import {
  PossibleDummyAssetValue,
  DataRangeQuery,
  BrandedAssetValue,
  AssetValueTimePoint,
  PossibleDummyHistoryValue,
} from "../schema";
import { arrayToAsyncIterator } from "./async";
import {
  multipleAssetWithSingleHistory,
  singleAssetWithSingleHistory,
} from "./assets-test-helpers";

describe("streamAssetValuesForDateRange for asset values with one asset with value", () => {
  it("should have syntthetic start and end points when single history value in between start and end", async () => {
    const assets = singleAssetWithSingleHistory;

    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-03-01T00:00:00Z");
    const query: DataRangeQuery = {
      start: startDate,
      end: endDate,
    };

    const assetsWithHistoryAsyncIterators = Array.from(assets, (asset) => ({
      ...asset,
      history: arrayToAsyncIterator(asset.history),
    }));

    const stream = streamAssetValuesForDateRange<BrandedAssetValue>(query)(
      mergeSortedAssetHistories<BrandedAssetValue>(
        assetsWithHistoryAsyncIterators
      )
    );

    const result: PossibleDummyAssetValue[] = [];
    for await (const v of stream) result.push(v);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeDefined();
    if (result[0]) {
      expect(result[0].value).toBe(0);
      expect(result[0].valueType).toBe("synthetic");
    }

    expect(result[1]).toBeDefined();
    if (result[1]) {
      expect(result[1].value).toBe(100);
      expect(result[1].valueType).toBe("asset");
    }
    expect(result[2]).toBeDefined();
    if (result[2]) {
      expect(result[2].value).toBe(100);
      expect(result[2].valueType).toBe("synthetic");
    }
  });

  it("should have foo", async () => {
    const assets = multipleAssetWithSingleHistory;

    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-03-01T00:00:00Z");

    const query: DataRangeQuery = {
      start: startDate,
      end: endDate,
    };

    const assetsWithHistoryAsyncIterators = Array.from(assets, (asset) => ({
      ...asset,
      history: arrayToAsyncIterator(asset.history),
    }));

    const stream = streamAssetValuesForDateRange<BrandedAssetValue>(query)(
      mergeSortedAssetHistories<BrandedAssetValue>(
        assetsWithHistoryAsyncIterators
      )
    );

    const combined = await getCombinedDayValuesForValues<
      PossibleDummyHistoryValue<BrandedAssetValue>,
      AssetValueTimePoint
    >(stream, ({ day, entry }) => day);

    expect(combined[0]).toBeDefined();
    if (combined[0]) {
      expect(combined[0].value).toBe(100);
    }
  });
});
