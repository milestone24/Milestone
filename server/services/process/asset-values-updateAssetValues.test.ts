import { describe, it, expect, vi } from "vitest";
import { db } from "@server/db";
import { AssetValuesService } from "./asset-values";
import {
  assetPersistenceFactory,
  DatabaseAssetService,
} from "@server/services/assets/database";
import { factory as queueFactory } from "@server/services/distributed/queue";
import { Message } from "@server/services/distributed/queue";
import { addDays, startOfMonth } from "date-fns";

describe("AssetValuesService", () => {
  const assetId = "78b2e68f-bb55-432f-b059-e9edb9d94f57";
  const accountId = "5d4f0f7f-723c-4296-a4cf-d4a7e41db225";

  const startDateOne = startOfMonth(new Date());
  const startDateTwo = addDays(startDateOne, 10);

  it(
    "should update asset values",
    async () => {
      await new Promise(async (resolve, reject) => {
        const startedIds: string[] = [];
        const exitedIds: string[] = [];

        const callback = vi
          .fn()
          .mockImplementation(async (message: Message) => {
            if (message.type === "asset-values-update-started") {
              startedIds.push(message.jobId);
            }
            if (message.type === "asset-values-update-exited") {
              exitedIds.push(message.jobId);
              if (exitedIds.length == 2 && startedIds.length == 2) {
                resolve(void 0);
              }
            }
          });

        const queueService = queueFactory();
        // Subscribe with the callback reference so we can track calls and unsubscribe properly
        queueService.subscribe(callback);

        const assetPersistence = assetPersistenceFactory(
          new DatabaseAssetService(db),
          assetId
        );
        const assetValuesService = new AssetValuesService(db);

        await new Promise(async (resolve, reject) => {
          try {
            assetValuesService.updateAssetValuesForAssetOfAccount(
              accountId,
              assetId,
              startDateOne
            );
            setTimeout(() => {
              assetValuesService.updateAssetValuesForAssetOfAccount(
                accountId,
                assetId,
                startDateTwo
              );
            }, 3000);
          } catch (error) {
            console.error("Error updating asset values", error);
          }
        });

        expect(callback).toHaveBeenCalledWith({
          type: "asset-values-update-exited",
          jobId: expect.any(String),
          accountId: expect.any(String),
          assetId: expect.any(String),
          startDate: startDateOne,
        });
      });
    },
    60000 * 5
  );
});
