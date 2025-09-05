//@ts-nocheck

import { describe, it, test, expect } from "vitest";

import { resolveDayValueHistoryForAssetsForDateRange } from "./assets";
import { AssetWithHistory, UserAsset, WithAssetHistory } from "@shared/schema";
import { arrayToAsyncIterator } from "./async";
import {
  generateMockAssetHistory,
  generateMockAssets,
} from "./assets-test-helpers";

describe("getPortfolioValueHistoryForAssets", () => {
  it.only("foo one", async () => {
    const assets: WithAssetHistory<UserAsset>[] = [
      {
        id: "a1",
        accountType: "calculated",
        name: "a1",
        startDate: new Date("2024-01-01T00:00:00Z"),
        valueMethod: "calculated",
        currentValue: 100,
        updatedAt: new Date("2024-01-10T00:00:00Z"),
        createdAt: new Date("2024-01-10T00:00:00Z"),
        userAccountId: "user-1",
        platformId: "platform-1",
        providerId: "provider-1",
        history: [
          {
            id: "v1",
            assetId: "a1",
            value: 100,
            entryMethod: "calculated",
            metadata: null,
            valueDate: new Date("2024-01-10T00:00:00Z"),
            recordedAt: new Date("2024-01-10T00:00:00Z"),
            createdAt: new Date("2024-01-10T00:00:00Z"),
            updatedAt: new Date("2024-01-10T00:00:00Z"),
          },
          {
            id: "v2",
            assetId: "a1",
            value: 150,
            entryMethod: "calculated",
            metadata: null,
            valueDate: new Date("2024-01-10T00:00:00Z"),
            recordedAt: new Date("2024-02-02T00:00:00Z"),
            createdAt: new Date("2024-02-02T00:00:00Z"),
            updatedAt: new Date("2024-02-02T00:00:00Z"),
          },
        ],
      },
      {
        id: "a2",
        history: [
          {
            id: "v1",
            assetId: "a2",
            value: 100,
            entryMethod: "calculated",
            metadata: null,
            valueDate: new Date("2024-01-10T00:00:00Z"),
            recordedAt: new Date("2024-01-02T10:00:00Z"),
            createdAt: new Date("2024-01-02T00:00:00Z"),
            updatedAt: new Date("2024-01-02T00:00:00Z"),
          },
          {
            id: "v2",
            assetId: "a2",
            value: 100,
            entryMethod: "calculated",
            metadata: null,
            valueDate: new Date("2024-01-10T00:00:00Z"),
            recordedAt: new Date("2024-01-10T10:00:00Z"),
            createdAt: new Date("2024-01-10T00:00:00Z"),
            updatedAt: new Date("2024-01-10T00:00:00Z"),
          },
        ],
      },
    ];

    const result = await resolveDayValueHistoryForAssetsForDateRange(assets, {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-03-01T10:00:00Z"),
    });

    console.log("result :", JSON.stringify(result, null, 2));

    expect(result).toHaveLength(5);
    expect(result[0]).toBeDefined();
    if (result[0]) {
      expect(result[0].value).toBe(0);
    }
    expect(result[1]).toBeDefined();
    if (result[1]) {
      expect(result[1].value).toBe(100);
    }
    expect(result[2]).toBeDefined();
    if (result[2]) {
      expect(result[2].value).toBe(200);
    }
    expect(result[3]).toBeDefined();
    if (result[3]) {
      expect(result[3].value).toBe(250);
    }
    expect(result[3]).toBeDefined();
    if (result[3]) {
      expect(result[3].value).toBe(250);
    }
  });

  it("foo two", async () => {
    const assets = [
      {
        id: "a1",
        history: [
          {
            id: "v1",
            assetId: "a1",
            value: 100,
            recordedAt: new Date("2024-01-01T00:00:00Z"),
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
          },
          {
            id: "v2",
            assetId: "a1",
            value: 150,
            recordedAt: new Date("2024-02-02T00:00:00Z"),
            createdAt: new Date("2024-02-02T00:00:00Z"),
            updatedAt: new Date("2024-02-02T00:00:00Z"),
          },
        ],
      },
      {
        id: "a2",
        history: [
          {
            id: "v1",
            assetId: "a2",
            value: 100,
            recordedAt: new Date("2024-01-01T10:00:00Z"),
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
          },
          {
            id: "v2",
            assetId: "a2",
            value: 100,
            recordedAt: new Date("2024-01-10T10:00:00Z"),
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
      },
    ];

    const result = await resolveDayValueHistoryForAssetsForDateRange(assets);

    console.log("result :", JSON.stringify(result, null, 2));

    expect(result).toHaveLength(3);
    expect(result[0]).toBeDefined();
    if (result[0]) {
      expect(result[0].value).toBe(200);
    }
    expect(result[1]).toBeDefined();
    if (result[1]) {
      expect(result[1].value).toBe(200);
    }
    expect(result[2]).toBeDefined();
    if (result[2]) {
      expect(result[2].value).toBe(250);
    }
  });

  it("returns correct portfolio history for a single asset with two values", async () => {
    const asset: AssetWithHistory = {
      id: "asset-1",
      history: [
        {
          id: "v1",
          assetId: "asset-1",
          value: 100,
          recordedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        {
          id: "v2",
          assetId: "asset-1",
          value: 150,
          recordedAt: new Date("2024-01-02T00:00:00Z"),
          createdAt: new Date("2024-01-02T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
        },
      ],
    };

    const result = await resolveDayValueHistoryForAssetsForDateRange([asset]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    if (result[0] && result[1]) {
      expect(result[0].date.toISOString().split("T")[0]).toBe("2024-01-01");
      expect(result[0].value).toBe(100);
      expect(result[1].date.toISOString().split("T")[0]).toBe("2024-01-02");
      expect(result[1].value).toBe(150);
    }
  });

  it("returns empty array for empty input", async () => {
    const result = await resolveDayValueHistoryForAssetsForDateRange([]);
    expect(result).toEqual([]);
  });

  it("handles a single asset with dense daily data", async () => {
    const asset = generateMockAssetHistory({
      id: "asset-1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-05"),
      intervalDays: 1,
      valueFn: (i) => 100 + i * 10,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange([asset]);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.value)).toEqual([100, 110, 120, 130, 140]);
    expect(result.map((r) => r.date.toISOString().split("T")[0])).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
    ]);
  });

  it("handles a single asset with sparse data (every 2 days)", async () => {
    const asset = generateMockAssetHistory({
      id: "asset-1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-07"),
      intervalDays: 2,
      valueFn: (i) => 200 + i * 20,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange([asset]);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.value)).toEqual([200, 220, 240, 260]);
    expect(result.map((r) => r.date.toISOString().split("T")[0])).toEqual([
      "2024-01-01",
      "2024-01-03",
      "2024-01-05",
      "2024-01-07",
    ]);
  });

  it("handles multiple assets with overlapping histories", async () => {
    const assets = generateMockAssets({
      count: 2,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-03"),
      intervalDays: 1,
      valueFn: (assetIdx, valueIdx) => 100 * (assetIdx + 1) + valueIdx * 10,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange(assets);
    expect(result).toHaveLength(3);
    // Day 1: 100+200, Day 2: 110+210, Day 3: 120+220
    expect(result.map((r) => r.value)).toEqual([300, 320, 340]);
    expect(result.map((r) => r.date.toISOString().split("T")[0])).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });

  it("handles multiple assets with non-overlapping histories", async () => {
    const asset1 = generateMockAssetHistory({
      id: "a1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-03"),
      intervalDays: 1,
      valueFn: (i) => 100 + i * 10,
    });
    const asset2 = generateMockAssetHistory({
      id: "a2",
      startDate: new Date("2024-01-04"),
      endDate: new Date("2024-01-06"),
      intervalDays: 1,
      valueFn: (i) => 200 + i * 20,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange([
      asset1,
      asset2,
    ]);
    expect(result).toHaveLength(6);
    expect(result.map((r) => r.value)).toEqual([
      100,
      110,
      120, // asset1 only
      0 + 200,
      0 + 220,
      0 + 240, // asset2 only, asset1 is 0
    ]);
    expect(result.map((r) => r.date.toISOString().split("T")[0])).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
      "2024-01-06",
    ]);
  });

  it("returns only values within the specified date range", async () => {
    const asset = generateMockAssetHistory({
      id: "asset-1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-10"),
      intervalDays: 1,
      valueFn: (i) => 100 + i * 10,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange([asset], {
      start: new Date("2024-01-03"),
      end: new Date("2024-01-05"),
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.value)).toEqual([120, 130, 140]);
    expect(result.map((r) => r.date.toISOString().split("T")[0])).toEqual([
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
    ]);
  });

  it("returns empty if no asset has values in the range", async () => {
    const asset = generateMockAssetHistory({
      id: "asset-1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-02"),
      intervalDays: 1,
      valueFn: (i) => 100 + i * 10,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange([asset], {
      start: new Date("2024-02-01"),
      end: new Date("2024-02-05"),
    });
    expect(result).toEqual([]);
  });

  it("handles assets with values on the same date (tie-breaking)", async () => {
    const asset1 = generateMockAssetHistory({
      id: "a1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-01"),
      valueFn: () => 100,
    });
    const asset2 = generateMockAssetHistory({
      id: "a2",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-01"),
      valueFn: () => 200,
    });
    const result = await resolveDayValueHistoryForAssetsForDateRange([
      asset1,
      asset2,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(300);
    expect(result[0].date.toISOString().split("T")[0]).toBe("2024-01-01");
  });

  it("handles unordered input histories", async () => {
    const asset = {
      id: "asset-1",
      history: [
        {
          id: "v2",
          assetId: "asset-1",
          value: 150,
          recordedAt: new Date("2024-01-02T00:00:00Z"),
          createdAt: new Date("2024-01-02T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
        },
        {
          id: "v1",
          assetId: "asset-1",
          value: 100,
          recordedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
      ],
    };
    const result = await resolveDayValueHistoryForAssetsForDateRange([asset]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    if (result[0] && result[1]) {
      expect(result[0].value).toBe(100);
      expect(result[1].value).toBe(150);
    }
  });
});
