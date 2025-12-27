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
} from "@server/services/distributed";

type Event = {
  jobId: string;
};

export const handler = async (event: Event) => {
  const { jobId } = event;

  const job = await db.query.processes.findFirst({
    where: and(eq(processes.id, jobId)),
  });

  console.log("handler Job", job);

  if (!job) {
    throw new Error("Job not found");
  }

  let abortController: AbortController = new AbortController();

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

  // run the update
  //when the update fiished trigger the asset values update??

  const userAccounts = await db.query.userAccounts.findMany();

  console.log("userAccounts", userAccounts);

  const userAssetsForAllAccounts = await db.query.userAssets.findMany({
    where: inArray(
      userAssets.userAccountId,
      userAccounts.map((userAccount) => userAccount.id)
    ),
  });

  const securitiesForAllAccounts = await db.query.userAssetSecurities.findMany({
    where: inArray(
      userAssetSecurities.userAssetId,
      userAssetsForAllAccounts.map((userAsset) => userAsset.id)
    ),
  });

  console.log("securitiesForAllAccounts", securitiesForAllAccounts);

  const startDate = securitiesForAllAccounts.reduce((min, security) => {
    return security.startDate < min ? security.startDate : min;
  }, new Date());

  const endDate = new Date();

  const updateJobWithStatus = async (status: ProcessStatus) => {
    console.log("updateJobWithStatus", status, job.id);
    if (job) {
      try {
        const result = await db
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
                  //error: "Asset values update aborted",
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
    securitiesForAllAccounts.map((security) => ({
      securityId: security.securityId,
      startDate: startDate,
      endDate: endDate,
    })),
    abortController.signal
  );

  const messageData: SecuritiesDailyHistoryCacheUpdateMessageBase = {
    jobId: jobId,
  };

  securitiesCacheUpdater.once("started", () => {
    updateJobWithStatus("running");
    queueService.publish({
      type: "securities-daily-history-cache-update-started",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("aborted", () => {
    updateJobWithStatus("aborted");
    queueService.publish({
      type: "securities-daily-history-cache-update-aborted",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("completed", () => {
    updateJobWithStatus("completed");
    queueService.publish({
      type: "securities-daily-history-cache-update-completed",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("failed", () => {
    updateJobWithStatus("failed");
    queueService.publish({
      type: "securities-daily-history-cache-update-failed",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  securitiesCacheUpdater.once("exited", () => {
    queueService.publish({
      type: "securities-daily-history-cache-update-exited",
      ...messageData,
    });
    queueService.unsubscribe(callback);
  });

  process.on("SIGINT", async () => {
    abortController.abort();
  });
  process.on("SIGTERM", () => {
    abortController.abort();
  });

  securitiesCacheUpdater.update();

  return securitiesCacheUpdater;
};
