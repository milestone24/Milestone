//@ts-nocheck

import { describe, it, expect } from "vitest";
import { mergeSortedAssetHistories } from "./assets";
import {
  AssetValue,
  AssetWithValueHistoryAsyncIterators,
} from "../schema";
import { arrayToAsyncIterator } from "./async";
import { generateMockAssetHistory } from "./assets-test-helpers";

describe("mergeSortedAssetHistories", () => {
  it.only("yields all values from a single asset in order", async () => {
    const asset1 = {
      id: "a1",
      history: arrayToAsyncIterator([
        {
          id: "v1",
          assetId: "a1",
          value: 10,
          recordedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        {
          id: "v1",
          assetId: "a1",
          value: 10,
          recordedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
      ]),
    };

    const asset2 = {
      id: "a1",
      history: arrayToAsyncIterator([
        {
          id: "v1",
          assetId: "a1",
          value: 10,
          recordedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        {
          id: "v1",
          assetId: "a1",
          value: 10,
          recordedAt: new Date("2024-01-01T00:00:00Z"),
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
      ]),
    };

    const result: AssetValue[] = [];
    for await (const v of mergeSortedAssetHistories([asset1, asset2])) {
      result.push(v);
    }
    expect(result).toHaveLength(4);
  });
  it("yields all values from a single asset in order", async () => {
    const asset: AssetWithValueHistoryAsyncIterators = {
      id: "a1",
      history: arrayToAsyncIterator(
        generateMockAssetHistory({
          id: "a1",
          startDate: new Date("2024-01-01T00:00:00Z"),
          endDate: new Date("2024-01-02T00:00:00Z"),
          intervalDays: 1,
          valueFn: (i) => (i === 0 ? 10 : 20),
        }).history
      ),
    };
    const result: AssetValue[] = [];
    for await (const v of mergeSortedAssetHistories([asset])) {
      result.push(v);
    }
    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    if (result[0] && result[1]) {
      expect(result[0].value).toBe(10);
      expect(result[1].value).toBe(20);
    }
  });

  it("merges two assets with interleaved dates", async () => {
    const asset1: AssetWithValueHistoryAsyncIterators = {
      id: "a1",
      history: arrayToAsyncIterator(
        generateMockAssetHistory({
          id: "a1",
          startDate: new Date("2024-01-01T00:00:00Z"),
          endDate: new Date("2024-01-03T00:00:00Z"),
          intervalDays: 2,
          valueFn: (i) => (i === 0 ? 10 : 30),
        }).history
      ),
    };
    const asset2: AssetWithValueHistoryAsyncIterators = {
      id: "a2",
      history: arrayToAsyncIterator(
        generateMockAssetHistory({
          id: "a2",
          startDate: new Date("2024-01-02T00:00:00Z"),
          endDate: new Date("2024-01-04T00:00:00Z"),
          intervalDays: 2,
          valueFn: (i) => (i === 0 ? 20 : 40),
        }).history
      ),
    };
    const result: AssetValue[] = [];
    for await (const v of mergeSortedAssetHistories([asset1, asset2])) {
      result.push(v);
    }
    expect(result).toHaveLength(4);
    expect(result.map((v) => v.value)).toEqual([10, 20, 30, 40]);
    expect(result.map((v) => v.assetId)).toEqual(["a1", "a2", "a1", "a2"]);
  });

  it("handles empty asset histories", async () => {
    const asset: AssetWithValueHistoryAsyncIterators = {
      id: "a1",
      history: arrayToAsyncIterator([]),
    };
    const result: AssetValue[] = [];
    for await (const v of mergeSortedAssetHistories([asset])) {
      result.push(v);
    }
    expect(result).toHaveLength(0);
  });

  it("handles one asset with sparse dates and another with dense dates", async () => {
    // Asset 1: Sparse (big date gaps)
    const assetSparse: AssetWithValueHistoryAsyncIterators = {
      id: "sparse",
      history: arrayToAsyncIterator(
        generateMockAssetHistory({
          id: "sparse",
          startDate: new Date("2020-01-01T00:00:00Z"),
          endDate: new Date("2030-01-01T00:00:00Z"),
          intervalDays: 3652, // ~10 years
          valueFn: (i) => (i === 0 ? 100 : 200),
        }).history
      ),
    };
    // Asset 2: Dense (many close dates)
    const assetDense: AssetWithValueHistoryAsyncIterators = {
      id: "dense",
      history: arrayToAsyncIterator(
        generateMockAssetHistory({
          id: "dense",
          startDate: new Date("2025-01-01T00:00:00Z"),
          endDate: new Date("2025-01-03T00:00:00Z"),
          intervalDays: 1,
          valueFn: (i) => [10, 20, 30][i] ?? 0,
        }).history
      ),
    };
    const result: AssetValue[] = [];
    for await (const v of mergeSortedAssetHistories([
      assetSparse,
      assetDense,
    ])) {
      result.push(v);
    }
    // Should be in strict date order
    expect(result.map((v) => v.recordedAt.toISOString().split("T")[0])).toEqual(
      ["2020-01-01", "2025-01-01", "2025-01-02", "2025-01-03", "2030-01-01"]
    );
    expect(result.map((v) => v.assetId)).toEqual([
      "sparse",
      "dense",
      "dense",
      "dense",
      "sparse",
    ]);
    expect(result.map((v) => v.value)).toEqual([100, 10, 20, 30, 200]);
  });
});
