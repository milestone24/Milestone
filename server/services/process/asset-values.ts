import { sendNotification } from "../comms/socket";
import { factory as securitiesFactory } from "@server/services/securities";
import { Database } from "@server/db";
import { and, eq, sql } from "drizzle-orm";
import { processes } from "@server/db/schema";
import { ProcessSelect } from "@shared/schema/process";
import { assetPersistenceFactory } from "@server/services/assets/database";
import { DatabaseAssetService } from "@server/services/assets/database";
import {
  processes as processesKey,
  assetSecurities,
  fireProjection,
  portfolioAssets,
  portfolioGraphTransactions,
  portfolioGraphValues,
  portfolioOverview,
} from "@shared/api/queryKeys";
const securitiesService = securitiesFactory();

export class AssetValuesService {
  private assetService: DatabaseAssetService;
  //TODO consider how to handle the abstraction of Db or
  constructor(private db: Database) {
    this.assetService = new DatabaseAssetService(db);
  }

  async updateAssetValues(
    accountId: string,
    assetId: string,
    startDate?: Date
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      sendNotification(accountId, {
        type: "notification",
        message: "Updating asset values...",
      });

      console.log(
        "Updating asset values for accountId",
        accountId,
        "and assetId",
        assetId
      );

      let abortController: AbortController | undefined;

      //First find an existing job for this assets that is running
      //Either find a way to cancel or wait for it to complete before executing
      //Posssibly a queue system?

      const existingJob = await this.db.query.processes.findFirst({
        where: and(
          eq(processes.key, "update-asset-values"),
          eq(processes.status, "running"),
          sql`payload ->> 'assetId' = ${assetId}`
        ),
      });

      if (existingJob) {
        sendNotification(accountId, {
          type: "notification",
          message: "Asset values are already being updated",
        });
        resolve();
        return;
      }

      abortController = new AbortController();

      let job: ProcessSelect | undefined;

      try {
        //TODO job needs some kind of identifier for what resources are affected
        [job] = await this.db
          .insert(processes)
          .values({
            key: "update-asset-values",
            status: "running",
            startedAt: new Date(),
            payload: {
              accountId,
              assetId,
            },
          })
          .returning();

        const assetPersistence = assetPersistenceFactory(
          this.assetService,
          assetId
        );

        securitiesService.updateAssetValuesSync(
          assetPersistence,
          abortController.signal,
          async () => {
            console.log(
              "Finished updating asset values for accountId",
              accountId,
              "and assetId",
              assetId
            );

            if (job) {
              await this.db
                .update(processes)
                .set({ status: "completed", completedAt: new Date() })
                .where(eq(processes.id, job.id));
            }
            this.sendAssetValuesInvalidatedNotification(accountId, assetId);
            sendNotification(accountId, {
              type: "notification",
              message: "Asset values updated",
            });
            resolve();
          },
          startDate
        );
      } catch (error) {
        console.error("Error updating asset values", error);

        if (job) {
          await this.db
            .update(processes)
            .set({ status: "failed", completedAt: new Date() })
            .where(eq(processes.id, job.id));
        }
        reject(error);
      }
    });
  }

  sendAssetValuesInvalidatedNotification = (
    accountId: string,
    assetId: string
  ) => {
    sendNotification(accountId, {
      type: "query",
      queryKeys: [
        [...portfolioGraphValues],
        [...portfolioGraphTransactions],
        [...processesKey],
        [...fireProjection],
        [...assetSecurities],
        [...portfolioOverview],
        [...portfolioAssets],
        ["assets", assetId],
      ],
    });
    sendNotification(accountId, {
      type: "notification",
      message: "Asset values invalidated",
    });
  };
}
