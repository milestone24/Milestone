import {
  AssetValuesUpdateMessageBase,
  factory as queueFactory,
} from "@server/services/distributed/queue";
import { AssetValuesUpdater } from "../securities/sync/asset-value";
import {
  AssetPersistence,
  assetPersistenceFactory,
  DatabaseAssetService,
} from "../assets/database";
import { db } from "@server/db";
import { processes, ProcessStatus } from "@server/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * This handler is used to behave a distributed manner.
 * It is designed to mimic distributed behaviour but actually
 * can be used locally in a non distributed environment or
 * delegated to from a distributed lambda function
 */

type Event = {
  assetId: string;
  accountId: string;
  jobId: string;
  startDate?: Date;
};

export const handler = async (event: Event) => {
  const { assetId, accountId, jobId, startDate } = event;

  let exitSignalTriggered = false;

  console.log("Asset values update started for start date", startDate);

  let abortController: AbortController = new AbortController();

  const signalTermCallback = () => {
    console.log("SIGINT or SIGTERM received");
    exitSignalTriggered = true;
    abortController.abort("SIGINT or SIGTERM received");
    process.off("SIGTERM", signalTermCallback);
  };

  const signalIntCallback = () => {
    console.log("SIGINT received");
    exitSignalTriggered = true;
    abortController.abort("SIGINT received");
    process.off("SIGINT", signalIntCallback);
  };

  process.on("SIGINT", signalIntCallback);
  process.on("SIGTERM", signalTermCallback);

  const job = await db.query.processes.findFirst({
    where: and(eq(processes.id, jobId)),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  const queueService = queueFactory();
  const callback = async (message: any) => {
    if (message.type === "asset-values-update-abort") {
      if (message.jobId === jobId) {
        console.log("Asset values update aborted for job", message.jobId);
        abortController.abort();
        queueService.unsubscribe(callback);
      }
    }
  };
  queueService.subscribe(callback);

  const assetPersistence: AssetPersistence = assetPersistenceFactory(
    new DatabaseAssetService(db),
    assetId
  );

  const updater = new AssetValuesUpdater(
    assetId,
    accountId,
    jobId,
    startDate ?? null,
    assetPersistence,
    abortController.signal
  );

  const updateJobWithStatus = async (status: ProcessStatus) => {
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

  const messageData: AssetValuesUpdateMessageBase = {
    jobId: jobId,
    accountId: accountId,
    assetId: assetId,
    startDate: startDate ?? undefined,
  };

  updater.once("started", async () => {
    await updateJobWithStatus("running");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-started",
    });
  });

  updater.once("completed", async () => {
    await updateJobWithStatus("completed");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-completed",
    });
  });
  updater.once("failed", async () => {
    await updateJobWithStatus("failed");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-failed",
    });
  });
  updater.once("aborted", async () => {
    await updateJobWithStatus("aborted");
    if (exitSignalTriggered) {
      console.log("Abort listener, SIGINT or SIGTERM received, exiting");
      process.exit(0);
    }
    queueService.publish({
      ...messageData,
      type: "asset-values-update-aborted",
    });
  });
  updater.once("exited", async () => {
    process.off("SIGINT", signalIntCallback);
    process.off("SIGTERM", signalTermCallback);
    queueService.publish({
      ...messageData,
      type: "asset-values-update-exited",
    });
  });

  updater.update();

  return updater;
};
