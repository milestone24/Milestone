import {
  AssetWithValueHistory,
  BrandedAssetValue,
  UserAsset,
  WithAssetHistory,
} from "@shared/schema";

export const singleAssetWithSingleHistory: WithAssetHistory<
  UserAsset,
  BrandedAssetValue
>[] = [
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
        recordType: "asset_value",
        value: 100,
        entryMethod: "calculated",
        metadata: null,
        valueDate: new Date("2024-01-10T00:00:00Z"),
        recordedAt: new Date("2024-01-10T00:00:00Z"),
        createdAt: new Date("2024-01-10T00:00:00Z"),
        updatedAt: new Date("2024-01-10T00:00:00Z"),
      },
    ],
  },
];

export const multipleAssetWithSingleHistory: WithAssetHistory<
  UserAsset,
  BrandedAssetValue
>[] = [
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
        recordType: "asset_value",
        value: 100,
        entryMethod: "calculated",
        metadata: null,
        valueDate: new Date("2024-01-10T00:00:00Z"),
        recordedAt: new Date("2024-01-10T00:00:00Z"),
        createdAt: new Date("2024-01-10T00:00:00Z"),
        updatedAt: new Date("2024-01-10T00:00:00Z"),
      },
      {
        id: "v1",
        assetId: "a1",
        recordType: "asset_value",
        value: 100,
        entryMethod: "calculated",
        metadata: null,
        valueDate: new Date("2024-01-20T00:00:00Z"),
        recordedAt: new Date("2024-01-20T00:00:00Z"),
        createdAt: new Date("2024-01-20T00:00:00Z"),
        updatedAt: new Date("2024-01-20T00:00:00Z"),
      },
    ],
  },
  {
    id: "a2",
    accountType: "calculated",
    name: "a2",
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
        assetId: "a2",
        recordType: "asset_value",
        value: 100,
        entryMethod: "calculated",
        metadata: null,
        valueDate: new Date("2023-12-20T00:00:00Z"),
        recordedAt: new Date("2024-01-10T00:00:00Z"),
        createdAt: new Date("2024-01-10T00:00:00Z"),
        updatedAt: new Date("2024-01-10T00:00:00Z"),
      },
      {
        id: "v2",
        assetId: "a2",
        recordType: "asset_value",
        value: 100,
        entryMethod: "calculated",
        metadata: null,
        valueDate: new Date("2024-01-20T00:00:00Z"),
        recordedAt: new Date("2024-01-20T00:00:00Z"),
        createdAt: new Date("2024-01-20T00:00:00Z"),
        updatedAt: new Date("2024-01-20T00:00:00Z"),
      },
      {
        id: "v3",
        assetId: "a2",
        recordType: "asset_value",
        value: 100,
        entryMethod: "calculated",
        metadata: null,
        valueDate: new Date("2024-01-20T00:00:00Z"),
        recordedAt: new Date("2024-01-20T00:00:00Z"),
        createdAt: new Date("2024-01-20T00:00:00Z"),
        updatedAt: new Date("2024-01-20T00:00:00Z"),
      },
    ],
  },
];

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
}: MockAssetOptions): AssetWithValueHistory {
  const history: BrandedAssetValue[] = [];
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
      recordType: "asset_value",
      recordedAt: new Date(current),
      createdAt: new Date(current),
      updatedAt: new Date(current),
    });
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    i++;
  }
  return {
    id,
    valueMethod: "manual",
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
}: GenerateMockAssetsOptions): AssetWithValueHistory[] {
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
