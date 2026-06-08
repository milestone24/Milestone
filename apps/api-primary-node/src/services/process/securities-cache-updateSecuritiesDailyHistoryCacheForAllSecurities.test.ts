import { describe, it, vi } from "vitest";

import { SecuritiesCacheService } from "./securities-cache";
import { db } from "@server/db";
import { expect } from "vitest";
import {
  factory as queueFactory,
  SecuritiesDailyHistoryCacheUpdateMessage,
} from "@server/services/distributed/queue";

describe("SecuritiesCacheService", async () => {
  it(
    "should update the securities daily history cache for all securities",
    async () => {
      const promise = new Promise(async (resolve, reject) => {
        const startedIds: string[] = [];
        const exitedIds: string[] = [];

        const callback = vi
          .fn()
          .mockImplementation(
            async (message: SecuritiesDailyHistoryCacheUpdateMessage) => {
              console.log("Message", message);
              if (
                message.type === "securities-daily-history-cache-update-started"
              ) {
                startedIds.push(message.jobId);
              }
              if (
                message.type === "securities-daily-history-cache-update-exited"
              ) {
                exitedIds.push(message.jobId);
                if (exitedIds.length == 1 && startedIds.length == 1) {
                  resolve(void 0);
                }
              }
            }
          );

        const queueService = queueFactory();
        queueService.subscribe(callback);

        const securitiesCacheService = new SecuritiesCacheService(db);

        await new Promise(async (resolve, reject) => {
          try {
            await securitiesCacheService.updateSecuritiesDailyHistoryCacheForAllSecurities();
          } catch (error) {
            console.error("Error updating asset values", error);
          }
        });
      });
      await expect(promise).resolves.toBeUndefined();
    },
    60000 * 5
  );
});
