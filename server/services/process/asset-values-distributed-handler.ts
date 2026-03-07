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
import { processes, ProcessSelect } from "@server/db/schema";
import { eq } from "drizzle-orm";
import {
  createAbortCompletionPromise,
  updateProcessStatus,
  waitForTerminalEvent,
} from "./job-helpers";
import { createJobScope } from "./job-scope";
import { registerShutdownHandler, DEFAULT_SHUTDOWN_TIMEOUT_MS } from "@server/utils/shutdown";

/**
 * Describes the input event required to start an asset values update job.
 * Can be dispatched locally or forwarded from a distributed Lambda function.
 */
type Event = {
  assetId: string;
  accountId: string;
  jobId: string;
  startDate?: Date;
};

/**
 * Handles an asset values update job in a distributed-compatible manner.
 *
 * Designed to run locally or be delegated to from a distributed environment
 * (e.g. a Lambda function). The handler coordinates the full lifecycle of
 * an asset values update: starting, running, completing, failing, or aborting.
 *
 * ## Shutdown / Abort Flow
 *
 * When a shutdown signal (SIGINT/SIGTERM) is received while a job is active,
 * the following sequence is guaranteed before the process exits:
 *
 * 1. The `AbortController` is signalled, which propagates cancellation into
 *    the `AssetValuesUpdater` via its `AbortSignal`.
 * 2. The updater emits `"aborted"`, triggering the aborted event handler.
 * 3. The DB job status is updated to `"aborted"`.
 * 4. The shutdown handler is unregistered.
 * 5. The abort message is published to the queue so downstream receivers
 *    can act with confidence that the DB state is already correct.
 * 6. `resolveAbort()` is called, which internally runs `checkAborted()` —
 *    a DB poll that confirms the status as the distributed source of truth
 *    before resolving `abortCompletePromise`.
 * 7. The shutdown coordinator receives the resolved promise and exits cleanly.
 *
 * ## Deferred Promise (`abortCompletePromise`)
 *
 * Uses the Deferred Promise pattern to bridge the updater's event-driven
 * abort sequence with the shutdown coordinator's async handler. The promise
 * is created unconditionally and its resolver (`resolveAbort`) is always
 * defined — the Promise constructor executor runs synchronously. If the job
 * completes or fails without a shutdown signal, `resolveAbort()` is still
 * called harmlessly with no awaiter.
 *
 * ## DB Poll (`checkAborted`)
 *
 * Polls the DB to confirm the job status is `"aborted"` as the distributed
 * source of truth. It is scoped to this handler and only ever triggered via
 * `resolveAbort()` — never called directly from the shutdown handler. The
 * poll interval and max tries are derived from `DEFAULT_SHUTDOWN_TIMEOUT_MS`
 * to stay within the coordinator's overall timeout budget.
 *
 * ## Scope-based cleanup
 *
 * The handler uses `await using jobScope = createJobScope(...)` so that when
 * the handler returns (after awaiting `waitForTerminalEvent(updater)`), the
 * job scope is disposed: unregisterShutdown and queue unsubscribe run, allowing
 * GC of listeners and subscriptions. The handler awaits a terminal event
 * (completed, failed, aborted, or exited) before returning so disposal always
 * runs at the right time.
 */
export const handler = async (event: Event) => {
  const { assetId, accountId, jobId, startDate } = event;

  console.log("Asset values update started for asset %s with start date %s", assetId, startDate);

  let abortController: AbortController = new AbortController();

  let job: ProcessSelect | undefined;

  const { promise: abortCompletePromise, resolve: resolveAbort } =
    createAbortCompletionPromise(jobId);

  /**
   * Registers with the central shutdown coordinator so the process does not
   * exit until this job's abort sequence has fully completed. The handler
   * signals the abort and then waits on `abortCompletePromise`, which
   * encapsulates the DB update, queue publish, and DB confirmation poll.
   */
  const unregisterShutdown = registerShutdownHandler(async (signal) => {
    console.log("Shutdown signal %s received for job %s", signal, jobId);
    abortController.abort(`shutdown signal: ${signal}`);
    console.log("Abort controller signalled for job", jobId, "- waiting for abort sequence to complete");
    await abortCompletePromise;
    console.log("Job confirmed aborted in DB for job", jobId);
  }, { timeout: DEFAULT_SHUTDOWN_TIMEOUT_MS });

  job = await db.query.processes.findFirst({
    where: eq(processes.id, jobId),
  });

  if (!job) {
    throw new Error("Job not found");
  }

  const queueService = queueFactory();

  /**
   * Listens for an external abort message on the queue.
   * Allows the job to be cancelled from outside this process
   * (e.g. from a distributed coordinator or admin action).
   */
  const callback = async (message: any) => {
    if (message.type === "asset-values-update-abort") {
      if (message.jobId === jobId) {
        console.log("External abort message received for job", message.jobId);
        abortController.abort();
        queueService.unsubscribe(callback);
      }
    }
  };
  queueService.subscribe(callback);

  await using jobScope = createJobScope({
    unregisterShutdown,
    unsubscribe: () => queueService.unsubscribe(callback),
  });

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
    await updateProcessStatus(jobId, "running");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-started",
    });
  });

  updater.once("completed", async () => {
    await updateProcessStatus(jobId, "completed");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-completed",
    });
  });

  updater.once("failed", async () => {
    await updateProcessStatus(jobId, "failed", "Error updating asset values");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-failed",
    });
  });

  /**
   * Handles the updater's abort event.
   *
   * Guarantees the following order before signalling completion:
   * 1. DB status set to "aborted"
   * 2. Abort message published — receivers can trust the DB state is correct
   * 3. `resolveAbort()` triggers `checkAborted()` to confirm DB as source of truth,
   *    then resolves `abortCompletePromise` to unblock the shutdown coordinator.
   * Shutdown unregister and queue unsubscribe run via job-scope disposal when the handler returns.
   */
  updater.once("aborted", async () => {
    console.log("Asset values update aborted for job", jobId);
    await updateProcessStatus(jobId, "aborted");
    queueService.publish({
      ...messageData,
      type: "asset-values-update-aborted",
    });
    resolveAbort();
  });

  updater.once("exited", async () => {
    queueService.publish({
      ...messageData,
      type: "asset-values-update-exited",
    });
  });

  updater.update();

  await waitForTerminalEvent(updater);
  return updater;
};
