import { describe, it, expect, vi } from "vitest";
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
  BrandedAbstractTransactionValue,
  WithValueHistory,
  WithAssetHistory,
  UserAsset,
} from "@shared/schema";
import { arrayToAsyncIterator } from "./async";
import {
  generateMockAssetHistory,
  multipleAssetWithSingleHistory,
  singleAssetWithSingleHistory,
} from "./assets-test-helpers";

import { DatabaseAssetService } from "@server/services/assets/database";
import { db } from "@server/db";
import { QueryParams } from "@server/utils/resource-query-builder";

const assetService = new DatabaseAssetService(db);

const userAccountId = "1ff054ec-b380-45b1-8e23-7e98514a68f2";

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

    // const startDate = new Date("2025-03-24T00:00:00Z");
    // const endDate = new Date("2025-09-24T00:00:00Z");

    const query: DataRangeQuery = {
      start: startDate,
      end: endDate,
    };

    // const assets =
    //   await assetService.getUserAssetsWithAssetValueHistoryWithBoundary(
    //     "1ff054ec-b380-45b1-8e23-7e98514a68f2",
    //     {
    //       filter: {
    //         start: {
    //           eq: startDate,
    //         },
    //         end: { eq: endDate },
    //       },
    //     }
    //   );

    console.log("assets :", assets.length);

    for (const asset of assets) {
      console.log("asset history length:", asset.history.length);
      console.log("asset history one :", asset.history[0]);
    }

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
    // for await (const v of stream) result.push(v);

    const combined = await getCombinedDayValuesForValues<
      PossibleDummyHistoryValue<BrandedAssetValue>,
      AssetValueTimePoint
    >(stream, ({ day, entry }) => day);

    console.log("result :", result.length);

    console.log("result :", combined.length);

    console.log("combined :", JSON.stringify(combined, null, 2));

    console.log("combined start :", combined[0]);

    expect(combined[0]).toBeDefined();
    if (combined[0]) {
      expect(combined[0].value).toBe(100);
      //expect(combined[0].valueType).toBe("synthetic");
    }

    // //expect(result).toHaveLength(6);
    // expect(result[0]).toBeDefined();
    // if (result[0]) {
    //   expect(result[0].value).toBe(100);
    //   expect(result[0].valueType).toBe("synthetic");
    // }

    // expect(result[1]).toBeDefined();
    // if (result[1]) {
    //   expect(result[1].value).toBe(100);
    //   expect(result[1].valueType).toBe("asset");
    // }
    // expect(result[2]).toBeDefined();
    // if (result[2]) {
    //   expect(result[2].value).toBe(100);
    //   expect(result[2].valueType).toBe("synthetic");
    // }
  });
});

describe.only("streamAssetValuesForDateRange for asset values with one asset with value", () => {
  it("should have syntthetic start and end points when single history value in between start and end", async () => {
    // const startDate = new Date("2024-01-01T00:00:00Z");
    // const endDate = new Date("2025-10-01T00:00:00Z");

    const startDate = new Date("2025-03-04T00:00:00Z");
    const endDate = new Date("2025-09-04T00:00:00Z");

    const queryParams: QueryParams = {
      filter: {
        start: {
          eq: startDate,
        },
        end: { eq: endDate },
      },
    };

    const dateRangeQuery: DataRangeQuery = {
      start: startDate,
      end: endDate,
    };

    const assets = await assetService
      .getUserAssets(userAccountId, queryParams)
      .then((assets) =>
        assets.filter(
          (asset) => asset.id === "ce95f3e8-5473-40d1-8077-625e4829bcd6"
        )
      );

    const withHistory: WithAssetHistory<
      UserAsset,
      BrandedAbstractTransactionValue
    >[] = await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        history:
          await assetService.getCombinedAssetTransactionsWithBoundariesForAsset(
            asset.id,
            queryParams
          ),
      }))
    );

    // const withHistory =
    //   await assetService.getCombinedAssetTransactionsWithBoundariesForUserAccount(
    //     userAccountId,
    //     queryParams
    //   );

    // for (const asset of withHistory) {
    //   for (const history of asset.history) {
    //     console.log("match : ", history.assetId, asset.id);
    //     expect(history.assetId).toBe(asset.id);
    //   }
    // }

    //console.log("withHistory :", JSON.stringify(withHistory, null, 2));

    // console.log(
    //   "withHistory :",
    //   JSON.stringify(
    //     withHistory.map((a) => a.history),
    //     null,
    //     2
    //   )
    // );

    const assetsWithHistoryAsyncIterators = Array.from(
      withHistory,
      (asset) => ({
        ...asset,
        history: arrayToAsyncIterator(asset.history),
      })
    );

    const mergedHistory =
      mergeSortedAssetHistories<BrandedAbstractTransactionValue>(
        assetsWithHistoryAsyncIterators
      );

    // for await (const v of mergedHistory) {
    //   console.log("mergedHistoryItem :", v);
    // }

    //return;

    const stream =
      streamAssetValuesForDateRange<BrandedAbstractTransactionValue>(
        dateRangeQuery,
        "accumulativeAssetCurrencyValue"
      )(mergedHistory);

    const result: PossibleDummyHistoryValue<BrandedAbstractTransactionValue>[] =
      [];

    // for await (const v of stream) {
    //   //console.log("streamItem :", v);
    //   result.push(v);
    // }

    // console.log("result :", result);

    // expect(result).toHaveLength(3);

    // console.log("result :", result);

    const combined = await getCombinedDayValuesForValues<
      PossibleDummyHistoryValue<BrandedAbstractTransactionValue>,
      AssetValueTimePoint
    >(stream, ({ day, entry }) => day);

    console.log("combined :", combined);

    expect(result[0]).toBeDefined();
    if (result[0]) {
      expect(result[0].value).toBe(1200000);
    }

    // expect(result).toHaveLength(3);
    // expect(result[0]).toBeDefined();
    // if (result[0]) {
    //   expect(result[0].value).toBe(0);
    //   expect(result[0].valueType).toBe("synthetic");
    // }

    // expect(result[1]).toBeDefined();
    // if (result[1]) {
    //   expect(result[1].value).toBe(100);
    //   expect(result[1].valueType).toBe("asset");
    // }
    // expect(result[2]).toBeDefined();
    // if (result[2]) {
    //   expect(result[2].value).toBe(100);
    //   expect(result[2].valueType).toBe("synthetic");
    // }
  });

  //TODO test with one asset with one value where value is before start date
  //TODO test with one asset with one value where value is after end date
});

// describe("streamAssetValuesForDateRange", () => {
//   it("yields all values as-is when no date range is given", async () => {
//     const values = generateMockAssetHistory({
//       id: "a1",
//       startDate: new Date("2024-01-01T00:00:00Z"),
//       endDate: new Date("2024-01-02T00:00:00Z"),
//       intervalDays: 1,
//       valueFn: (i) => (i === 0 ? 10 : 20),
//     }).history;
//     const stream = streamAssetValuesForDateRange()(
//       arrayToAsyncIterator(values)
//     );
//     const result: PossibleDummyAssetValue[] = [];
//     for await (const v of stream) result.push(v);
//     expect(result).toHaveLength(2);
//     expect(result[0]).toBeDefined();
//     expect(result[1]).toBeDefined();
//     if (result[0] && result[1]) {
//       expect(result[0].value).toBe(10);
//       expect(result[1].value).toBe(20);
//     }
//   });

//   it("yields only values within the exact date range", async () => {
//     const values = generateMockAssetHistory({
//       id: "a1",
//       startDate: new Date("2024-01-01T00:00:00Z"),
//       endDate: new Date("2024-01-03T00:00:00Z"),
//       intervalDays: 1,
//       valueFn: (i) => [10, 20, 30][i] ?? 0,
//     }).history;
//     const query: DataRangeQuery = {
//       start: new Date("2024-01-02T00:00:00Z"),
//       end: new Date("2024-01-03T00:00:00Z"),
//     };
//     const stream = streamAssetValuesForDateRange(query)(
//       arrayToAsyncIterator(values)
//     );
//     const result: PossibleDummyAssetValue[] = [];
//     for await (const v of stream) result.push(v);
//     expect(result).toHaveLength(2);
//     expect(result[0]).toBeDefined();
//     expect(result[1]).toBeDefined();
//     if (result[0] && result[1]) {
//       expect(result[0].value).toBe(20);
//       expect(result[1].value).toBe(30);
//     }
//   });

//   it("inserts synthetic values at boundaries when no exact start/end exists", async () => {
//     const values = generateMockAssetHistory({
//       id: "a1",
//       startDate: new Date("2024-01-02T00:00:00Z"),
//       endDate: new Date("2024-01-04T00:00:00Z"),
//       intervalDays: 2,
//       valueFn: (i) => (i === 0 ? 10 : 20),
//     }).history;
//     const query: DataRangeQuery = {
//       start: new Date("2024-01-01T00:00:00Z"),
//       end: new Date("2024-01-05T00:00:00Z"),
//     };
//     const stream = streamAssetValuesForDateRange(query)(
//       arrayToAsyncIterator(values)
//     );
//     const result: PossibleDummyAssetValue[] = [];
//     for await (const v of stream) result.push(v);
//     expect(result).toHaveLength(4);
//     expect(result[0]).toBeDefined();
//     expect(result[1]).toBeDefined();
//     expect(result[2]).toBeDefined();
//     expect(result[3]).toBeDefined();
//     if (result[0] && result[1] && result[2] && result[3]) {
//       expect(result[0].recordedAt.toISOString().split("T")[0]).toBe(
//         "2024-01-01"
//       ); // synthetic start
//       expect(result[0].value).toBe(0); // synthetic value
//       expect(result[1].value).toBe(10);
//       expect(result[2].value).toBe(20);
//       expect(result[3].recordedAt.toISOString().split("T")[0]).toBe(
//         "2024-01-05"
//       ); // synthetic end
//       expect(result[3].value).toBe(20); // last known value
//     }
//   });

//   it("yields nothing for empty input and no range", async () => {
//     const stream = streamAssetValuesForDateRange()(arrayToAsyncIterator([]));
//     const result: PossibleDummyAssetValue[] = [];
//     for await (const v of stream) result.push(v);
//     expect(result).toHaveLength(0);
//   });

//   it("yields only synthetic values for empty input with a range", async () => {
//     const query: DataRangeQuery = {
//       start: new Date("2024-01-01T00:00:00Z"),
//       end: new Date("2024-01-02T00:00:00Z"),
//     };
//     const stream = streamAssetValuesForDateRange(query)(
//       arrayToAsyncIterator([])
//     );
//     const result: PossibleDummyAssetValue[] = [];
//     for await (const v of stream) result.push(v);
//     // If input is empty, output should be empty regardless of range
//     expect(result).toHaveLength(0);
//   });
// });
