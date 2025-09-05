//@ts-nocheck

import { describe, it, expect } from "vitest";
import { streamAssetValuesForDateRange } from "./assets";
import { PossibleDummyAssetValue, DataRangeQuery } from "@shared/schema";
import { arrayToAsyncIterator } from "./async";
import { generateMockAssetHistory } from "./assets-test-helpers";

describe("streamAssetValuesForDateRange", () => {
  it("yields all values as-is when no date range is given", async () => {
    const values = generateMockAssetHistory({
      id: "a1",
      startDate: new Date("2024-01-01T00:00:00Z"),
      endDate: new Date("2024-01-02T00:00:00Z"),
      intervalDays: 1,
      valueFn: (i) => (i === 0 ? 10 : 20),
    }).history;
    const stream = streamAssetValuesForDateRange()(
      arrayToAsyncIterator(values)
    );
    const result: PossibleDummyAssetValue[] = [];
    for await (const v of stream) result.push(v);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    if (result[0] && result[1]) {
      expect(result[0].value).toBe(10);
      expect(result[1].value).toBe(20);
    }
  });

  it("yields only values within the exact date range", async () => {
    const values = generateMockAssetHistory({
      id: "a1",
      startDate: new Date("2024-01-01T00:00:00Z"),
      endDate: new Date("2024-01-03T00:00:00Z"),
      intervalDays: 1,
      valueFn: (i) => [10, 20, 30][i] ?? 0,
    }).history;
    const query: DataRangeQuery = {
      start: new Date("2024-01-02T00:00:00Z"),
      end: new Date("2024-01-03T00:00:00Z"),
    };
    const stream = streamAssetValuesForDateRange(query)(
      arrayToAsyncIterator(values)
    );
    const result: PossibleDummyAssetValue[] = [];
    for await (const v of stream) result.push(v);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    if (result[0] && result[1]) {
      expect(result[0].value).toBe(20);
      expect(result[1].value).toBe(30);
    }
  });

  it("inserts synthetic values at boundaries when no exact start/end exists", async () => {
    const values = generateMockAssetHistory({
      id: "a1",
      startDate: new Date("2024-01-02T00:00:00Z"),
      endDate: new Date("2024-01-04T00:00:00Z"),
      intervalDays: 2,
      valueFn: (i) => (i === 0 ? 10 : 20),
    }).history;
    const query: DataRangeQuery = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };
    const stream = streamAssetValuesForDateRange(query)(
      arrayToAsyncIterator(values)
    );
    const result: PossibleDummyAssetValue[] = [];
    for await (const v of stream) result.push(v);
    expect(result).toHaveLength(4);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeDefined();
    expect(result[3]).toBeDefined();
    if (result[0] && result[1] && result[2] && result[3]) {
      expect(result[0].recordedAt.toISOString().split("T")[0]).toBe(
        "2024-01-01"
      ); // synthetic start
      expect(result[0].value).toBe(0); // synthetic value
      expect(result[1].value).toBe(10);
      expect(result[2].value).toBe(20);
      expect(result[3].recordedAt.toISOString().split("T")[0]).toBe(
        "2024-01-05"
      ); // synthetic end
      expect(result[3].value).toBe(20); // last known value
    }
  });

  it("yields nothing for empty input and no range", async () => {
    const stream = streamAssetValuesForDateRange()(arrayToAsyncIterator([]));
    const result: PossibleDummyAssetValue[] = [];
    for await (const v of stream) result.push(v);
    expect(result).toHaveLength(0);
  });

  it("yields only synthetic values for empty input with a range", async () => {
    const query: DataRangeQuery = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-02T00:00:00Z"),
    };
    const stream = streamAssetValuesForDateRange(query)(
      arrayToAsyncIterator([])
    );
    const result: PossibleDummyAssetValue[] = [];
    for await (const v of stream) result.push(v);
    // If input is empty, output should be empty regardless of range
    expect(result).toHaveLength(0);
  });
});
