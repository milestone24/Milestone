/**
 * Shared job/process helpers for distributed handlers: status updates,
 * abort-completion promise (DB poll), and terminal-event wait. Used by
 * asset-values and securities-cache distributed handlers.
 *
 * ## Risk of job left in running (or pending) state
 *
 * Trigger-and-forget handler invocation means a job can stay non-terminal if:
 * the process dies before emitting "started" (stays pending), or after "started"
 * but before a terminal event (stays running); or if updateProcessStatus fails
 * (DB/network) and only logs. Running and pending are best-effort. Intended
 * safeguards: reconciliation or stale-job sweep (periodic job or cron that marks
 * jobs failed when running/pending longer than a TTL based on startedAt). Do not
 * make handler invocation synchronous — that would break trigger-and-forget.
 *
 * ## Timeouts
 *
 * createAbortCompletionPromise polls the DB every POLL_INTERVAL_MS (1s) until the job
 * is aborted or MAX_TRIES is reached. MAX_TRIES is derived from DEFAULT_SHUTDOWN_TIMEOUT_MS
 * (30s) so the poll fits within the shutdown handler's timeout. Reconciliation TTLs
 * (process-reconcile) must be greater than this so we do not mark a job stale during
 * normal shutdown. See process-abort-wait.ts for the full timeout overview.
 */
import { db } from "@server/db";
import { processes, ProcessStatus } from "@server/db/schema";
import { and, eq } from "drizzle-orm";
import { DEFAULT_SHUTDOWN_TIMEOUT_MS } from "@server/utils/shutdown";

/**
 * Updates the job record in the DB with the given status.
 * Sets `completedAt` for terminal states (completed, failed, aborted)
 * and clears it for non-terminal states (e.g. running).
 *
 * Errors are caught and logged by design; they are not rethrown. This supports
 * trigger-and-forget and distributed architecture: a single job's DB update
 * failure must not propagate (unhandled rejections, process exit). Workers
 * stay available for other work. Job state inconsistency is an accepted
 * trade-off; use monitoring, timeouts, or reconciliation for visibility.
 */
export async function updateProcessStatus(
  jobId: string,
  status: ProcessStatus,
  errorMessage?: string
): Promise<void> {
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
                error: errorMessage ?? "Process failed",
              }
            : status === "aborted"
              ? { status, completedAt: new Date() }
              : { status, completedAt: null }
      )
      .where(eq(processes.id, jobId))
      .returning();
  } catch (error) {
    console.error(
      "[job-helpers] Error updating process status jobId=%s status=%s",
      jobId,
      status,
      error
    );
  }
}

const TERMINAL_STATUSES: ProcessStatus[] = ["completed", "failed", "aborted"];

/**
 * Returns whether the caller should continue work. Implements cooperative cancellation:
 * checks the AbortSignal and, when jobId is provided, the job's status in the DB.
 * If the signal is aborted or the job is already terminal (completed/failed/aborted),
 * returns false so the updater can exit cleanly. When jobId is omitted, only the
 * signal is checked (no DB read). See docs/process-stale-jobs-industry-patterns.md
 * (ownership / job still valid).
 */
export async function shouldContinue(
  abortSignal: AbortSignal,
  options?: { jobId?: string }
): Promise<boolean> {
  if (abortSignal.aborted) {
    return false;
  }
  if (options?.jobId) {
    const job = await db.query.processes.findFirst({
      where: eq(processes.id, options.jobId),
      columns: { status: true },
    });
    if (job && TERMINAL_STATUSES.includes(job.status)) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves with `task` when it settles first. If `signal` aborts first, rejects
 * with a `DOMException` named `AbortError` so callers can align with shutdown /
 * external abort paths without leaving the losing promise as an unhandled rejection.
 */
export function racePromiseWithAbortSignal<T>(
  task: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    task.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );

    const onAbort = () => {
      const reason =
        typeof signal.reason === "string" && signal.reason.length > 0
          ? signal.reason
          : "Aborted";
      finish(() => reject(new DOMException(reason, "AbortError")));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

const POLL_INTERVAL_MS = 1_000;
const MAX_TRIES = Math.floor(DEFAULT_SHUTDOWN_TIMEOUT_MS / POLL_INTERVAL_MS);

/**
 * Creates a Deferred Promise that resolves only after the job status is confirmed
 * as "aborted" in the DB (distributed source of truth).
 *
 * Returns `{ promise, resolve }`. Call `resolve()` after the abort sequence
 * (DB update, queue publish) is complete. The resolver internally polls the DB
 * to confirm status before resolving the promise.
 */
export function createAbortCompletionPromise(jobId: string): {
  promise: Promise<void>;
  resolve: () => void;
} {
  const checkAborted = (() => {
    let tries = 0;
    return async (): Promise<boolean> => {
      const current = await db.query.processes.findFirst({
        where: and(eq(processes.id, jobId)),
      });
      if (current?.status === "aborted") {
        return true;
      }
      if (tries >= MAX_TRIES) {
        throw new Error(`checkAborted: job ${jobId} not aborted after ${MAX_TRIES} tries`);
      }
      tries++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      return checkAborted();
    };
  })();

  let resolveAbort!: () => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolveAbort = () => checkAborted().then(() => resolve()).catch(reject);
  });

  return { promise, resolve: resolveAbort };
}

const TERMINAL_EVENTS = ["completed", "failed", "aborted", "exited"] as const;

/**
 * Returns a promise that resolves when the emitter fires any terminal event
 * (completed, failed, aborted, or exited). Used so the handler can await
 * job completion before returning and allow scope-based cleanup (e.g. await using).
 */
export function waitForTerminalEvent(emitter: {
  once(event: string, listener: (...args: unknown[]) => void): void;
}): Promise<void> {
  return new Promise((resolve) => {
    const onTerminal = () => resolve();
    for (const event of TERMINAL_EVENTS) {
      emitter.once(event, onTerminal);
    }
  });
}
