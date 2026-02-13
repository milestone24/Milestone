import { and, eq, inArray } from "drizzle-orm";
import {
  populateSecuritiesDailyHistoryCache,
  SecuritiesCacheUpdater,
} from "../securities/sync/cache";
import { db } from "@server/db";
import {
  ProcessStatus,
  processes,
  userAssetSecurities,
  userAssets,
} from "@server/db/schema";
import {
  factory as queueFactory,
  SecuritiesDailyHistoryCacheUpdateMessageBase,
} from "@server/services/distributed/queue";

type Event = {
  jobId: string;
};

export const handler = async (event: Event) => {
  const { jobId } = event;

  let exitSignalTriggered = false;

  const job = await db.query.processes.findFirst({
    where: and(eq(processes.id, jobId)),
  });

  console.log("handler Job", job);

  if (!job) {
    throw new Error("Job not found");
  }

  let abortController: AbortController = new AbortController();

  const signalTermCallback = () => {
    console.log("SIGINT or SIGTERM received");
    exitSignalTriggered = true;
    abortController.abort("SIGINT or SIGTERM received");
    //process.off("SIGTERM", signalTermCallback);
  };

  const signalIntCallback = () => {
    console.log("SIGINT received");
    exitSignalTriggered = true;
    abortController.abort("SIGINT received");
    //process.off("SIGINT", signalIntCallback);
  };

  process.on("SIGINT", signalIntCallback);
  process.on("SIGTERM", signalTermCallback);

  const queueService = queueFactory();
  const callback = async (message: any) => {
    if (message.type === "securities-cache-update-abort") {
      if (message.jobId === jobId) {
        console.log("Securities cache update aborted for job", message.jobId);
        abortController.abort();
        queueService.unsubscribe(callback);
      }
    }
  };
  queueService.subscribe(callback);

  const payload = job.payload as
    | { date: Date }
    | { securityId: string; startDate: Date; groupId?: string; accountId?: string };
  const isPerSecurityJob = "securityId" in payload && typeof payload.securityId === "string";

  let securityContexts: { securityId: string; startDate: Date; endDate: Date }[];

  if (isPerSecurityJob) {
    const startDate =
      payload.startDate instanceof Date
        ? payload.startDate
        : new Date(payload.startDate);
    securityContexts = [
      {
        securityId: payload.securityId,
        startDate,
        endDate: new Date(),
      },
    ];
  } else {
    const userAccounts = await db.query.userAccounts.findMany();
    const userAssetsForAllAccounts = await db.query.userAssets.findMany({
      where: inArray(
        userAssets.userAccountId,
        userAccounts.map((userAccount) => userAccount.id)
      ),
    });
    const securitiesForAllAccounts =
      await db.query.userAssetSecurities.findMany({
        where: inArray(
          userAssetSecurities.userAssetId,
          userAssetsForAllAccounts.map((userAsset) => userAsset.id)
        ),
      });
    securityContexts = securitiesForAllAccounts.map((security) => ({
      securityId: security.securityId,
      startDate: security.startDate,
      endDate: new Date(),
    }));
  }

  const updateJobWithStatus = async (status: ProcessStatus) => {
    if (job) {
      try {
        await db
          .update(processes)
          .set(
            status === "completed"
              ? { status, completedAt: new Date() }
              : status === "failed"
              ? {
                  status,
                  completedAt: new Date(),
                  error: "Error updating asset values",
                }
              : status === "aborted"
              ? {
                  status,
                  completedAt: new Date(),
                }
              : { status, completedAt: null }
          )
          .where(eq(processes.id, job.id))
          .returning();
      } catch (error) {
        console.error("Error updating job with status", error);
      }
    }
  };

  const securitiesCacheUpdater = new SecuritiesCacheUpdater(
    jobId,
    securityContexts,
    abortController.signal
  );

  const messageData: SecuritiesDailyHistoryCacheUpdateMessageBase = {
    jobId: jobId,
    ...(isPerSecurityJob &&
      "groupId" in payload &&
      payload.groupId !== undefined && { groupId: payload.groupId }),
    ...(isPerSecurityJob &&
      "accountId" in payload &&
      payload.accountId !== undefined && { accountId: payload.accountId }),
  };

  securitiesCacheUpdater.once("started", async () => {
    await updateJobWithStatus("running");
    queueService.publish({
      type: "securities-daily-history-cache-update-started",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("aborted", async () => {
    await updateJobWithStatus("aborted");
    if (exitSignalTriggered) {
      console.log("Abort listener, SIGINT or SIGTERM received, exiting");
      process.exit(0);
    }
    queueService.publish({
      type: "securities-daily-history-cache-update-aborted",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("completed", async () => {
    await updateJobWithStatus("completed");
    queueService.publish({
      type: "securities-daily-history-cache-update-completed",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("failed", async () => {
    await updateJobWithStatus("failed");
    queueService.publish({
      type: "securities-daily-history-cache-update-failed",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("exited", () => {
    process.off("SIGINT", signalIntCallback);
    process.off("SIGTERM", signalTermCallback);
    queueService.publish({
      type: "securities-daily-history-cache-update-exited",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.update();

  return securitiesCacheUpdater;
};
