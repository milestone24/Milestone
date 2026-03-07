/**
 * Shared job/process helpers for distributed handlers: status updates,
 * abort-completion promise (DB poll), and terminal-event wait. Used by
 * asset-values and securities-cache distributed handlers.
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
    console.error("Error updating job with status", error);
  }
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
