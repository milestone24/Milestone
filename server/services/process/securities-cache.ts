import { Database } from "@server/db";
import { assetSecurities } from "@shared/api/queryKeys";
import { sendNotification } from "../comms/socket";
import { and, eq, inArray, not, or, sql } from "drizzle-orm";
import { UpdateSecuritiesDailyHistoryCacheProcess } from "@shared/schema/process";
import { processes, ProcessSelect } from "@server/db/schema";
import { handler } from "./securities-cache-distributed-handler";
import { factory as queueFactory } from "@server/services/distributed/queue";

export class SecuritiesCacheService {
  //TODO consider how to handle the abstraction of Db or
  constructor(
    //TODO maybe use job or process persistence factory instead of db?
    private db: Database
  ) {}

  async updateSecuritiesDailyHistoryCacheForAllSecurities(): Promise<void> {
    //Send notification to all accounts that the securities daily history cache is being updated.
    // sendNotification(accountId, {
    //   type: "notification",
    //   message: "Updating securities daily history cache...",
    // });

    const findExistingProcesses = async (excludeIds?: string[]) => {
      const jobs: UpdateSecuritiesDailyHistoryCacheProcess[] = await this.db.query.processes.findMany({
        where: and(
          eq(processes.key, "update-securities-daily-history-cache"),
          or(
            eq(processes.status, "running"),
            eq(processes.status, "pending")
          ),
          excludeIds ? not(inArray(processes.id, excludeIds)) : undefined,
        )
      }) as UpdateSecuritiesDailyHistoryCacheProcess[] ?? [];
      return jobs;
    };

    const queueService = queueFactory();

    let job: ProcessSelect | undefined;

    try {

      const existingJobs: UpdateSecuritiesDailyHistoryCacheProcess[] =
        await findExistingProcesses();

      if (existingJobs.length > 0) {
        queueService.publish({
          type: "securities-daily-history-cache-update-failed",
          jobId: undefined,
          message: "Securities daily history cache update already in progress",
        });
        //Do we need to wait and run again?
        return;
      }

      [job] = await this.db
        .insert(processes)
        .values({
          key: "update-securities-daily-history-cache",
          status: "running",
          startedAt: new Date(),
          payload: {
            date: new Date(),
          },
        })
        .returning();

      if (!job) {
        queueService.publish({
          type: "securities-daily-history-cache-update-failed",
          jobId: undefined,
          message: "Failed to create job",
        });
        return;
      }

      const distributed = process.env.DISTRIBUTED === "true";

      if (distributed) {
        // mockLambdaHandler({
        //   jobId: job.id,
        // });
      } else {
        handler({ jobId: job.id })
      }
    } catch (error) {
      if (job) {
        await this.db
          .update(processes)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(processes.id, job.id));
      }
      queueService.publish({
        type: "securities-daily-history-cache-update-failed",
        jobId: job?.id,
        message: "Error updating securities daily history cache",
      });
      return;
    }

  }
}
