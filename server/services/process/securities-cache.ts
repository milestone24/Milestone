/**
 * Securities cache process service: orchestrates securities daily history
 * cache updates. Uses trigger-and-forget handler invocation; coordination
 * is via DB state and queue events for distributed readiness.
 */
import { Database } from "@server/db";
import { eq, inArray, sql } from "drizzle-orm";
import { UpdateSecuritiesDailyHistoryCacheProcess } from "@shared/schema/process";
import { processes, ProcessSelect } from "@server/db/schema";
import { handler } from "./securities-cache-distributed-handler";
import { factory as queueFactory } from "@server/services/distributed/queue";
import {
  findRunningOrPendingProcesses,
  waitForProcessesToAbort,
} from "./process-abort-wait";
import {
  DEFAULT_PENDING_TTL_MS,
  DEFAULT_RUNNING_TTL_MS,
  startPeriodicReconciliationForResource,
} from "./process-reconcile";

/**
 * Service for creating and running securities daily history cache update
 * jobs. Inserts process rows, invokes the distributed handler (trigger-and-forget),
 * and uses findRunningOrPendingProcesses / waitForProcessesToAbort to avoid
 * duplicate work per security or for full refresh. Callers rely on queue
 * events and DB state for completion.
 */
export class SecuritiesCacheService {
  //TODO consider how to handle the abstraction of Db or
  constructor(
    //TODO maybe use job or process persistence factory instead of db?
    private db: Database
  ) {}

  async updateSecuritiesDailyHistoryCacheForSecurity(
    securityId: string,
    groupId?: string,
    accountId?: string,
    startDate?: Date
  ): Promise<void> {
    const resolvedStartDate = startDate ?? new Date();
    const queueService = queueFactory();
    const distributed = process.env.DISTRIBUTED === "true";

    let job: ProcessSelect | undefined;

    try {
      [job] = await this.db
        .insert(processes)
        .values({
          key: "update-securities-daily-history-cache",
          status: "pending",
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

      const existingJobs =
        await findRunningOrPendingProcesses<UpdateSecuritiesDailyHistoryCacheProcess>(
          this.db,
          "update-securities-daily-history-cache",
          {
            excludeIds: [job.id],
            metaCondition: sql`payload->>'securityId' = ${securityId}`,
          }
        );

      if (existingJobs.length > 0) {
        for (const existing of existingJobs) {
          queueService.publish({
            type: "securities-daily-history-cache-update-abort",
            jobId: existing.id,
          });
        }
        try {
          await waitForProcessesToAbort(
            this.db,
            "update-securities-daily-history-cache",
            {
              excludeIds: [job.id],
              metaCondition: sql`payload->>'securityId' = ${securityId}`,
            }
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
      }

      if (distributed) {
        // mockLambdaHandler({ jobId: job.id });
      } else {
        handler({ jobId: job.id }).catch((error) => {
          const jobIdText = job
            ? job.id
            : "undefined (job not defined when logging handler error)";
          console.error(
            "[update-securities-daily-history-cache] Distributed handler error securityId=%s jobId=%s",
            securityId,
            jobIdText,
            error
          );
        });
      }

      // Periodic reconciliation: check this job by id against TTL until terminal or max duration.
      // See process-reconcile.ts.
      startPeriodicReconciliationForResource({
        jobId: job.id,
        pendingTtlMs: DEFAULT_PENDING_TTL_MS,
        runningTtlMs: DEFAULT_RUNNING_TTL_MS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Error creating job for security ${securityId}: ${message}`);
    }
  }

  async updateSecuritiesDailyHistoryCacheForSecurities(
    securityIds: string[],
    groupId?: string,
    accountId?: string,
    startDate?: Date
  ): Promise<void> {
    const uniqueSecurityIds = [...new Set(securityIds)];
    await Promise.all(
      uniqueSecurityIds.map((securityId) =>
        this.updateSecuritiesDailyHistoryCacheForSecurity(securityId, groupId, accountId, startDate)
      )
    );
  }

  

  async updateSecuritiesDailyHistoryCacheForAllSecurities(): Promise<void> {
    //Send notification to all accounts that the securities daily history cache is being updated.
    // sendNotification(accountId, {
    //   type: "notification",
    //   message: "Updating securities daily history cache...",
    // });

    const queueService = queueFactory();

    let job: ProcessSelect | undefined;

    try {
      const existingJobs =
        await findRunningOrPendingProcesses<UpdateSecuritiesDailyHistoryCacheProcess>(
          this.db,
          "update-securities-daily-history-cache"
        );

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
          status: "pending",
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
        handler({ jobId: job.id }).catch((error) => {
          const jobIdText = job
            ? job.id
            : "undefined (job not defined when logging handler error)";
          console.error(
            "[update-securities-daily-history-cache] Distributed handler error scope=all jobId=%s",
            jobIdText,
            error
          );
        });
      }

      // Periodic reconciliation: check this job by id against TTL until terminal or max duration.
      // See process-reconcile.ts.
      startPeriodicReconciliationForResource({
        jobId: job.id,
        pendingTtlMs: DEFAULT_PENDING_TTL_MS,
        runningTtlMs: DEFAULT_RUNNING_TTL_MS,
      });
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
