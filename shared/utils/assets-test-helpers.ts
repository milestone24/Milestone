import { AssetWithHistory, AssetValue } from "@shared/schema";

export type MockAssetOptions = {
  id?: string;
  startDate: Date;
  endDate: Date;
  intervalDays?: number;
  valueFn?: (i: number) => number;
};

export function generateMockAssetHistory({
  id = "asset-1",
  startDate,
  endDate,
  intervalDays = 1,
  valueFn = (i) => i * 10 + 100,
}: MockAssetOptions): AssetWithHistory {
  const history: AssetValue[] = [];
  let current = new Date(startDate);
  let i = 0;
  while (current <= endDate) {
    history.push({
      id: `${id}-v${i}`,
      assetId: id,
      value: valueFn(i),
      valueDate: new Date(current),
      entryMethod: "manual",
      metadata: null,
      recordedAt: new Date(current),
      createdAt: new Date(current),
      updatedAt: new Date(current),
    });
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    i++;
  }
  return {
    id,
    history,
  };
}

export type GenerateMockAssetsOptions = {
  count: number;
  startDate: Date;
  endDate: Date;
  intervalDays?: number;
  valueFn?: (assetIndex: number, valueIndex: number) => number;
};

export function generateMockAssets({
  count,
  startDate,
  endDate,
  intervalDays = 1,
  valueFn = (assetIndex, valueIndex) => assetIndex * 100 + valueIndex * 10,
}: GenerateMockAssetsOptions): AssetWithHistory[] {
  return Array.from({ length: count }, (_, assetIndex) =>
    generateMockAssetHistory({
      id: `asset-${assetIndex + 1}`,
      startDate,
      endDate,
      intervalDays,
      valueFn: (i) => valueFn(assetIndex, i),
    })
  );
} 
