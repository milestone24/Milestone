import { Database } from "@server/db";
import { and, eq, inArray, not, or, SQL, sql } from "drizzle-orm";
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

  private async findExistingProcesses(
    processKey: string,
    excludeIds?: string[],
    metaCondition?: SQL<unknown>
  ): Promise<UpdateSecuritiesDailyHistoryCacheProcess[]> {
    const jobs: UpdateSecuritiesDailyHistoryCacheProcess[] = await this.db.query.processes.findMany({
      where: and(
        eq(processes.key, processKey),
        or(
          eq(processes.status, "running"),
          eq(processes.status, "pending")
        ),
        excludeIds ? not(inArray(processes.id, excludeIds)) : undefined,
        metaCondition ? metaCondition : undefined,
      )
    }) as UpdateSecuritiesDailyHistoryCacheProcess[] ?? [];
    return jobs;
  }

  private async waitForJobsToAbort(processKey: string, excludeIds?: string[], metaCondition?: SQL<unknown>) {
    const timeout = 20000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
    }, timeout);
    let iterations = 0;

    while (true) {
      iterations++;

      const jobs = await this.findExistingProcesses(processKey, excludeIds, metaCondition);

      console.log(`Iteration ${iterations}: found ${jobs.length} jobs, timedOut=${timedOut}`);

      if (jobs.length === 0) {
        clearTimeout(timeoutId);
        return;
      }

      //wait for 5 second before checking again
      if (timedOut) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    clearTimeout(timeoutId);
    throw new Error("Jobs did not abort in time");
  };

  private async findAndWaitForExistingProcessesAbort(processKey: string, excludeIds?: string[], metaCondition?: SQL<unknown>): Promise<ProcessSelect[]> {
    const jobs: UpdateSecuritiesDailyHistoryCacheProcess[] = await this.findExistingProcesses(processKey, excludeIds, metaCondition);

    if (jobs.length > 0) {
      const queueService = queueFactory();
      for (const job of jobs) {
        queueService.publish({
          type: "securities-daily-history-cache-update-abort",
          jobId: job.id,
        });
      }
      try {
        await this.waitForJobsToAbort(processKey, excludeIds, metaCondition);
      } catch (error) {
        throw new Error("Error waiting for jobs to abort");
      }
    }
    return jobs;
  }

  async updateSecuritiesDailyHistoryCacheForSecurities(
    securityIds: string[],
    groupId?: string,
    accountId?: string,
    startDate?: Date
  ): Promise<void> {
    const resolvedStartDate = startDate ?? new Date();
    const queueService = queueFactory();
    const distributed = process.env.DISTRIBUTED === "true";

    for (const securityId of securityIds) {
      let job: ProcessSelect | undefined;

      try {
        [job] = await this.db
          .insert(processes)
          .values({
            key: "update-securities-daily-history-cache",
            status: "running",
            startedAt: new Date(),
            payload: {
              securityId,
              startDate: resolvedStartDate,
              ...(groupId !== undefined && { groupId }),
              ...(accountId !== undefined && { accountId }),
            },
          })
          .returning();

        if (!job) {
          throw new Error("Failed to create job");
        }

        try {
          await this.findAndWaitForExistingProcessesAbort(
            "update-securities-daily-history-cache",
            [job.id],
            sql`payload->>'securityId' = ${securityId}`
          );
        } catch (error) {
          await this.db
            .update(processes)
            .set({ status: "failed", completedAt: new Date() })
            .where(eq(processes.id, job.id));
          queueService.publish({
            type: "securities-daily-history-cache-update-failed",
            jobId: job.id,
            message: "Error waiting for jobs to abort",
          });
          throw new Error("Error waiting for jobs to abort");
        }

        if (distributed) {
          // mockLambdaHandler({ jobId: job.id });
        } else {
          handler({ jobId: job.id });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Error creating job for security ${securityId}: ${message}`);
      }
    }
  }

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
          //Should this not be pending?
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
