/**
 * Asset values process service: orchestrates asset value updates and
 * securities cache coordination. Uses trigger-and-forget handler invocation;
 * coordination is via DB state and queue events for distributed readiness.
 */
import { sendNotification } from "../comms/socket";
import { Database } from "@server/db";
import { and, eq, sql } from "drizzle-orm";
import { processes, userAssets, userAssetSecurities } from "@server/db/schema";
import { UUID_REGEX } from "@server/utils/uuid";
import {
  ProcessSelect,
  UpdateAssetValuesProcess,
} from "@shared/schema/process";
import {
  processes as processesKey,
  assetProcesses,
  assetSecurities,
  fireProjection,
  portfolioAssets,
  portfolioGraphTransactions,
  portfolioGraphValues,
  portfolioOverview,
  assetGraphValues,
  assetGraphTransactions,
  assetValues,
  portfolioValue,
} from "@shared/api/queryKeys";
import { factory as queueFactory } from "@server/services/distributed/queue";
import { mockLambdaHandler } from "./asset-values-mock-lambda";
import { handler } from "./asset-values-distributed-handler";
import { SecuritiesCacheUpdater } from "../securities/sync/cache";
import { SecuritiesCacheService } from "./securities-cache";
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
 * Service for creating and running asset-value update jobs. Inserts process
 * rows, invokes the distributed handler (trigger-and-forget), and uses
 * findRunningOrPendingProcesses / waitForProcessesToAbort to avoid duplicate
 * work. Callers rely on queue events and DB state for completion.
 */
export class AssetValuesService {
  private securitiesCacheService: SecuritiesCacheService;

  //TODO consider how to handle the abstraction of Db or
  constructor(
    //TODO maybe use job or process persistence factory instead of db?
    private db: Database,
  ) {
    this.securitiesCacheService = new SecuritiesCacheService(db);
  }

  async initAssetValuesForAssetOfAccount(
    accountId: string,
    assetId: string
  ): Promise<void> {
    const asset = await this.db.query.userAssets.findFirst({
      where: eq(userAssets.userAccountId, accountId),
    });

    if (!asset) {
      throw new Error("Asset not found");
    }

    const securityContexts = await this.db.query.userAssetSecurities.findMany({
      where: eq(userAssetSecurities.userAssetId, asset.id),
    });

    const securityIds = securityContexts.map(
      (securityContext) => securityContext.securityId
    );

    if (securityIds.length === 0) {
      return;
    }

    const earliestStartDate = securityContexts.reduce(
      (min, securityContext) =>
        securityContext.startDate < min ? securityContext.startDate : min,
      new Date()
    );

    await this.securitiesCacheService.updateSecuritiesDailyHistoryCacheForSecurities(
      securityIds,
      assetId,
      accountId,
      earliestStartDate
    );

    // Asset-values update is triggered when all cache jobs for this asset complete (check group complete in chain).
  }

  async updateAssetValuesForAssetOfAccount(
    accountId: string,
    assetId: string,
    startDate?: Date
  ): Promise<void> {

    console.log(
      "[update-asset-values] accountId=%s assetId=%s startDate=%s",
      accountId,
      assetId,
      startDate ?? "undefined"
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

    let job: ProcessSelect | undefined;

    const queueService = queueFactory();

    try {
      [job] = await this.db
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
        queueService.publish({
          accountId,
          assetId,
          type: "asset-values-update-failed",
          jobId: undefined,
          message: "Failed to create job",
        });
        return;
      }

      //First find an existing job for this assets that is running
      const existingJobs = await findRunningOrPendingProcesses<UpdateAssetValuesProcess>(
        this.db,
        "update-asset-values",
        {
          excludeIds: [job.id],
          metaCondition: sql`payload ->> 'assetId' = ${assetId}`,
        }
      );

      console.log(
        "[update-asset-values] assetId=%s existing running/pending count=%s newJobId=%s",
        assetId,
        existingJobs.length,
        job.id
      );

      if (existingJobs.length > 0) {
        //Dispatch an event to abort the jobs
        //Normally there would only be one existing for the same assets but we have to consider
        //the possibility of race conditions and that there might be multiple jobs for the same asset.
        //So a dispatch event is sent to each job to abort it.
        for (const ejob of existingJobs) {
          queueService.publish({
            type: "asset-values-update-abort",
            jobId: ejob.id,
          });
        }

        console.log(
          "[update-asset-values] assetId=%s aborting jobIds=%s newJobId=%s",
          assetId,
          existingJobs.map((j) => j.id).join(","),
          job.id
        );

        // Wait for the jobs to abort. startDate is not redefined from running/pending
        // jobs (they are aborted and never commit); downstream derives range from
        // the latest asset value in the DB (getLastAssetValue).

        try {
          await waitForProcessesToAbort(this.db, "update-asset-values", {
            excludeIds: [job.id],
            metaCondition: sql`payload ->> 'assetId' = ${assetId}`,
          });
        } catch (error) {
          console.error(
            "[update-asset-values] Error waiting for jobs to abort accountId=%s assetId=%s jobId=%s",
            accountId,
            assetId,
            job.id,
            error
          );

          await this.db
            .update(processes)
            .set({ status: "failed", completedAt: new Date() })
            .where(eq(processes.id, job.id));

          queueService.publish({
            accountId,
            assetId,
            type: "asset-values-update-failed",
            jobId: job.id,
            message: "Error waiting for jobs to abort",
          });

          return;
        }
      }

      console.log(
        "[update-asset-values] Continuing accountId=%s assetId=%s jobId=%s startDate=%s",
        accountId,
        assetId,
        job.id,
        startDate ?? "undefined"
      );

      //TODO job needs some kind of identifier for what resources are affected
      //Should the creation of a job be done through a message queue to prevent race conditions?

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
        }).catch((error) => {
          const jobIdText = job
            ? job.id
            : "undefined (job not defined when logging handler error)";
          console.error(
            "[update-asset-values] Distributed handler error accountId=%s assetId=%s jobId=%s",
            accountId,
            assetId,
            jobIdText,
            error
          );
        });
      }

      // Periodic reconciliation: check this job by id against TTL every RECONCILE_INTERVAL_MS
      // for up to RECONCILE_MAX_DURATION_MS. If the handler dies or stops touching the row,
      // the job is marked failed so it does not stay running indefinitely. See process-reconcile.ts.
      startPeriodicReconciliationForResource({
        jobId: job.id,
        pendingTtlMs: DEFAULT_PENDING_TTL_MS,
        runningTtlMs: DEFAULT_RUNNING_TTL_MS,
      });

      sendNotification(accountId, {
        type: "query",
        queryKeys: [[...assetProcesses, assetId]],
      });
    } catch (error) {
      console.error(
        "[update-asset-values] Error updating asset values accountId=%s assetId=%s jobId=%s",
        accountId,
        assetId,
        job?.id ?? "none",
        error
      );

      if (job) {
        await this.db
          .update(processes)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(processes.id, job.id));
      }

      queueService.publish({
        accountId,
        assetId,
        type: "asset-values-update-failed",
        jobId: job?.id,
        message: "Error updating asset values",
      });
    };
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
        [...assetGraphValues],
        [...assetValues],
        [...assetGraphTransactions],
        [...portfolioOverview],
        [...portfolioValue],
        [...portfolioAssets],
        ["assets", assetId],
      ],
    });
    sendNotification(accountId, {
      type: "notification",
      message: "Asset values invalidated",
    });
  };

  async updateAssetValuesForAllAssetsOfAccount(
    accountId: string,
    startDate?: Date
  ): Promise<void> {
    const assets = await this.db.query.userAssets.findMany({
      where: eq(userAssets.userAccountId, accountId),
    });

    console.log(
      "[update-asset-values] updateAssetValuesForAllAssetsOfAccount accountId=%s filteredAssetIds=%s",
      accountId,
      assets.map((a) => a.id).join(",")
    );
    //Could this be done in a parallel manner?
    for (const asset of assets) {
      await this.updateAssetValuesForAssetOfAccount(
        accountId,
        asset.id,
        startDate
      );
    }
  }

  async updateAssetValuesForAllAssetsOfAllAccounts(
    startDate?: Date
  ): Promise<void> {
    const accounts = await this.db.query.userAccounts.findMany();

    //Could this be done in a parallel manner?
    for (const account of accounts) {
      await this.updateAssetValuesForAllAssetsOfAccount(account.id, startDate);
    }
  }

  /** Full-refresh group sentinel: when groupId equals this, trigger update for all assets of all accounts. */
  static readonly FULL_REFRESH_GROUP_ID = "full-refresh";

  /**
   * Check if all cache jobs in the group are done (completed, failed, or aborted).
   * If so, trigger asset-values update for that asset (or all assets when groupId is full-refresh).
   */
  async checkGroupCompleteAndTriggerAssetValues(groupId: string): Promise<void> {
    const groupJobs = await this.db.query.processes.findMany({
      where: and(
        eq(processes.key, "update-securities-daily-history-cache"),
        sql`payload->>'groupId' = ${groupId}`
      ),
      columns: { id: true, status: true, payload: true },
    });

    if (groupJobs.length === 0) {
      return;
    }

    const terminalStatuses = ["completed", "failed", "aborted"] as const;
    const allDone = groupJobs.every((j) =>
      terminalStatuses.includes(j.status as (typeof terminalStatuses)[number])
    );

    console.log(
      "[update-asset-values] checkGroupCompleteAndTriggerAssetValues groupId=%s jobCount=%s allDone=%s",
      groupId,
      groupJobs.length,
      allDone
    );

    if (!allDone) {
      return;
    }

    if (groupId === AssetValuesService.FULL_REFRESH_GROUP_ID) {
      await this.updateAssetValuesForAllAssetsOfAllAccounts();
      return;
    }

    if (!UUID_REGEX.test(groupId)) {
      return;
    }

    const assetId = groupId;
    const firstWithAccountId = groupJobs.find(
      (j) => j.payload && typeof j.payload === "object" && "accountId" in j.payload
    );
    const payload = firstWithAccountId?.payload as
      | { accountId?: string; startDate?: string }
      | undefined;
    const accountId = payload?.accountId;
    const startDateStr = payload?.startDate;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;

    if (!accountId) {
      return;
    }

    await this.updateAssetValuesForAssetOfAccount(accountId, assetId, startDate);
  }
}
