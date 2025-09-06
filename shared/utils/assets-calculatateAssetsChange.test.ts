import { describe, it, expect } from "vitest";
import { calculateAssetsChange, normalisePercentage } from "./assets";
import {
  PossibleDummyAssetValue,
  UserAsset,
  WithAssetHistory,
} from "@shared/schema";

describe("calculateAssetsChange", () => {
  it("should calculate the assets change", () => {
    const history: PossibleDummyAssetValue[] = [
      {
        value: 300,
        valueDate: new Date("2021-01-01"),
        entryMethod: "manual",
        metadata: null,
        updatedAt: new Date("2021-01-01"),
        createdAt: new Date("2021-01-01"),
        recordedAt: new Date("2021-01-01"),
        assetId: "1",
        valueType: "asset",
        id: "1",
      },
      {
        value: 2000,
        valueDate: new Date("2021-01-02"),
        entryMethod: "manual",
        metadata: null,
        updatedAt: new Date("2021-01-02"),
        createdAt: new Date("2021-01-02"),
        recordedAt: new Date("2021-01-02"),
        assetId: "1",
        valueType: "asset",
        id: "2",
      },
    ];
    const change = calculateAssetsChange(history);
    expect(change).toEqual({
      startDate: new Date("2021-01-01"),
      endDate: new Date("2021-01-02"),
      startValue: 300,
      value: 2000,
      currentChange: 1700,
      currentChangePercentage: 85,
    });
  });
});
