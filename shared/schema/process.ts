import {
  ProcessSelect as DBProcessSelect,
  processStatuses,
} from "@server/db/schema";
import z from "zod";

export type ProcessSelect = Omit<DBProcessSelect, "key" | "payload"> &
  (
    | {
        key: "update-asset-values";
        payload: {
          accountId: string;
          assetId: string;
          startDate: Date;
        };
      }
    | {
        key: string;
        payload: Record<string, unknown>;
      }
  );

export type UpdateAssetValuesProcess = Omit<
  DBProcessSelect,
  "key" | "payload"
> & {
  key: "update-asset-values";
  payload: {
    accountId: string;
    assetId: string;
    startDate: Date;
  };
};

export type OtherProcess = Omit<DBProcessSelect, "key" | "payload"> & {
  key: string;
  payload: Record<string, unknown>;
};

export const isUpdateAssetValuesProcess = (
  process: ProcessSelect
): process is UpdateAssetValuesProcess => process.key === "update-asset-values";

export const isOtherProcess = (
  process: ProcessSelect
): process is OtherProcess => process.key !== "update-asset-values";
