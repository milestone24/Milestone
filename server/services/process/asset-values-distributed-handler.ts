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
import { processes, ProcessSelect, ProcessStatus } from "@server/db/schema";
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

  console.log("Asset values update started for asset %s with start date %s", assetId, startDate);

  let abortController: AbortController = new AbortController();

  let job: ProcessSelect | undefined;

  const checkAborted = (() => {

    let tries = 0;

    return async () => {
      console.log("Checking if job is aborted on try %s", tries);
      const job = await db.query.processes.findFirst({
        where: and(eq(processes.id, jobId)),
      });
      if (job?.status === "aborted") {
        return true;
      }
      if (tries > 10) {
        throw new Error("Job not aborted after 10 tries");
      }
      tries++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return checkAborted();
    }
  })();

  const updateJobWithStatus = async (jobId: string, status: ProcessStatus) => {
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
                  //error: "Asset values update aborted",
                }
                : { status, completedAt: null }
        )
        .where(eq(processes.id, jobId))
        .returning();
    } catch (error) {
      console.error("Error updating job with status", error);
    }
  };

  const signalTermCallback = async () => {
    console.log("SIGTERM received");
    exitSignalTriggered = true;

    //signalling the abort contrller is useless as it is an async event that would never trigger.
    abortController.abort("SIGINT or SIGTERM received");
    //await updateJobWithStatus(jobId, "aborted");
    const aborted = await checkAborted();

    console.log("SIGTERM received, job aborted", aborted);

    process.off("SIGTERM", signalTermCallback);

    console.log("SIGTERM received, Complete");
  };

  const signalIntCallback = async () => {
    console.log("SIGINT received");
    exitSignalTriggered = true;
    //await updateJobWithStatus(jobId, "aborted");

    //signalling the abort contrller is useless as it is an async event that would never trigger.
    abortController.abort("SIGINT received");
    await checkAborted();
    process.off("SIGINT", signalIntCallback);
  };

  process.on("SIGINT", signalIntCallback);
  process.on("SIGTERM", signalTermCallback);

  const processListenersOff = () => {
    process.off("SIGINT", signalIntCallback);
    process.off("SIGTERM", signalTermCallback);
  };

  job = await db.query.processes.findFirst({
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

  const messageData: AssetValuesUpdateMessageBase = {
    jobId: jobId,
    accountId: accountId,
    assetId: assetId,
    startDate: startDate ?? undefined,
  };

  updater.once("started", async () => {
    await updateJobWithStatus(jobId, "running");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-started",
    });
  });

  updater.once("completed", async () => {
    await updateJobWithStatus(jobId, "completed");
    processListenersOff();
    queueService.publish({
      ...messageData,
      type: "asset-values-update-completed",
    });
  });
  updater.once("failed", async () => {
    await updateJobWithStatus(jobId, "failed");
    processListenersOff();
    queueService.publish({
      ...messageData,
      type: "asset-values-update-failed",
    });
  });
  updater.once("aborted", async () => {
    console.log("Asset values update aborted for job", jobId);
    await updateJobWithStatus(jobId, "aborted");
    // if (exitSignalTriggered) {
    //   console.log("Abort listener, SIGINT or SIGTERM received, exiting");
    //   process.exit(0);
    // }
    processListenersOff();
    queueService.publish({
      ...messageData,
      type: "asset-values-update-aborted",
    });
  });
  updater.once("exited", async () => {
    processListenersOff();
    queueService.publish({
      ...messageData,
      type: "asset-values-update-exited",
    });
  });

  updater.update();

  return updater;
};
