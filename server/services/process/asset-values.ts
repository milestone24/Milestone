import { sendNotification } from "../comms/socket";
import { Database } from "@server/db";
import { and, eq, or, sql } from "drizzle-orm";
import { processes } from "@server/db/schema";
import {
  ProcessSelect,
  UpdateAssetValuesProcess,
} from "@shared/schema/process";
import {
  processes as processesKey,
  assetSecurities,
  fireProjection,
  portfolioAssets,
  portfolioGraphTransactions,
  portfolioGraphValues,
  portfolioOverview,
} from "@shared/api/queryKeys";
import { factory as queueFactory } from "@server/services/distributed";
import { mockLambdaHandler } from "./asset-values-mock-lambda";
import { handler } from "./asset-values-distributed-handler";

export class AssetValuesService {
  //TODO consider how to handle the abstraction of Db or
  constructor(
    //TODO maybe use job or process persistence factory instead of db?
    private db: Database
  ) {}

  async updateAssetValuesForAssetOfAccount(
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
        assetId,
        "and start date",
        startDate
      );

      //Now we manually trigger the distributed event to signal to other asset update jobs for the same asset to abort.
      //We should consider adding new job would trigger a distributed event to signal to other asset update jobs for the same asset to abort.

      //Existing jobs abort logic.
      //find all jobs that are still running.
      //If there are no running jobs, we can continue.
      //If there are running jobs, we dispatch an event to abort them.
      //We wait for the jobs to abort.
      //We will presume if all jobs are a status other than running or pending then it is safe to continue.
      //This logic would reside in each instance of a horizontal scaling backend.
      //The invocation of an actual asset values update is distributed to a handler function that can be distributable eventually.

      //We will eventually change the process for updating asset values to use temporary tables to store updated data
      //and then swap the temporary table with the final table.
      //Therefore if the swap process is already in process, we must wait for it to complete before continuing.      //Do we then need to pu the rest of the folling code in a callback.

      //First find an existing job for this assets that is running
      const existingJobs: UpdateAssetValuesProcess[] =
        ((await this.db.query.processes.findMany({
          where: and(
            eq(processes.key, "update-asset-values"),
            or(
              eq(processes.status, "running"),
              eq(processes.status, "pending")
            ),
            sql`payload ->> 'assetId' = ${assetId}`
          ),
        })) as UpdateAssetValuesProcess[]) ?? [];

      const defineEarliestStartDate = async (
        processes: UpdateAssetValuesProcess[]
      ) => {
        const earliestStartDate = processes.reduce((min, process) => {
          const startDate = new Date(process.payload.startDate);
          return startDate < min ? startDate : min;
        }, new Date());
        return earliestStartDate;
      };

      const waitForJobsToAbort = async () => {
        const timeout = 20000;
        let timedOut = false;
        const timeoutId = setTimeout(() => {
          timedOut = true;
        }, timeout);

        while (true) {
          const jobs = await this.db.query.processes.findMany({
            where: and(
              eq(processes.key, "update-asset-values"),
              or(
                eq(processes.status, "running"),
                eq(processes.status, "pending")
              )
            ),
          });

          if (jobs.length === 0) {
            clearTimeout(timeoutId);
            return;
          }

          //wait for 2 second before checking again
          if (timedOut) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        throw new Error("Jobs did not abort in time");
      };

      console.log("Asset Values Service Existing jobs", existingJobs.length);

      if (existingJobs.length > 0) {
        const queueService = queueFactory();
        //Dispatch an event to abort the jobs
        //Normally there would only be one existing for the same assets but we have to consider
        //the possibility of race conditions and that there might be multiple jobs for the same asset.
        //So a dispatch event is sent to each job to abort it.
        for (const job of existingJobs) {
          queueService.publish({
            type: "asset-values-update-abort",
            jobId: job.id,
          });
        }
        //We have to consider start dates here.
        //If a running job has a start date that is before the start date of the new job,
        //we need to start the new job from the start date of the running job.
        startDate = await defineEarliestStartDate(existingJobs);
        //Wait for the jobs to abort
        await waitForJobsToAbort();
      }

      console.log("Continuing with update asset values startDate", startDate);

      let job: ProcessSelect | undefined;

      try {
        //TODO job needs some kind of identifier for what resources are affected
        //Should the creation of a job be done through a message queue to prevent race conditions?

        const [job] = await this.db
          .insert(processes)
          .values({
            key: "update-asset-values",
            //The status would be set to running by the distributed handler
            status: "pending",
            startedAt: new Date(),
            payload: {
              accountId,
              assetId,
              startDate,
            },
          })
          .returning();

        if (!job) {
          throw new Error("Failed to create job");
        }

        const distributed = process.env.DISTRIBUTED === "true";

        if (distributed) {
          //later relaced with an invocation of the lambda function
          mockLambdaHandler({
            assetId,
            accountId,
            jobId: job.id,
            startDate,
          });
        } else {
          handler({
            assetId,
            accountId,
            jobId: job.id,
            startDate,
          });
        }

        resolve();
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
