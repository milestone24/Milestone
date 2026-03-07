/**
 * Shared process abort-wait utilities for the process module. Used by
 * AssetValuesService and SecuritiesCacheService to find running/pending jobs
 * and wait for them to abort (e.g. before starting a replacement job).
 *
 * ## Process status semantics (pending vs running)
 *
 * - **pending:** Job row created; handler may not have been invoked yet or has
 *   not yet signalled that work has started (no "started" event from updater).
 *   Insert should always use pending when creating a process row.
 * - **running:** Handler has started the job (updater has emitted "started").
 *   Work is in progress until a terminal event (completed, failed, aborted).
 *   Only the distributed handler sets status to running, when the updater emits "started".
 *
 * ## Timeouts and polling (process module)
 *
 * - **Shutdown** (server/utils/shutdown): DEFAULT_SHUTDOWN_TIMEOUT_MS = 30s. Handlers
 *   register with this; abort-completion poll in job-helpers is sized to fit within it.
 * - **Wait for processes to abort** (this file): DEFAULT_WAIT_TIMEOUT_MS = 20s,
 *   DEFAULT_POLL_INTERVAL_MS = 5s. Callers can override via WaitOptions so a process
 *   can specify its own wait times.
 * - **Reconciliation** (process-reconcile): TTLs (pending 5 min, running 15 min) must be
 *   greater than the above so we do not mark a job stale while it is still within
 *   normal shutdown or wait-for-abort windows.
 */
import type { Database } from "@server/db";
import { processes } from "@server/db/schema";
import type { ProcessSelect } from "@shared/schema/process";
import type { SQL } from "drizzle-orm";
import { and, eq, inArray, not, or } from "drizzle-orm";

export type FindOptions = {
  excludeIds?: string[];
  metaCondition?: SQL<unknown>;
};

/** Options for waitForProcessesToAbort. Callers can pass timeoutMs and pollIntervalMs to use process-specific wait times. */
export type WaitOptions = FindOptions & {
  /** Max time to wait for running/pending jobs to disappear. Default 20s. */
  timeoutMs?: number;
  /** Interval between DB polls. Default 5s. */
  pollIntervalMs?: number;
};

/** Default max wait for other jobs to abort before starting a replacement. 20s. */
export const DEFAULT_WAIT_TIMEOUT_MS = 20_000;
/** Default interval between polls when waiting for jobs to abort. 5s. */
export const DEFAULT_POLL_INTERVAL_MS = 5_000;

/**
 * Finds processes for a given key that are currently running or pending.
 * Optional filters:
 * - excludeIds: omit specific process IDs
 * - metaCondition: extra SQL condition on the row (e.g. payload filters)
 */
export async function findRunningOrPendingProcesses<
  T extends ProcessSelect = ProcessSelect
>(
  db: Database,
  processKey: string,
  options: FindOptions = {}
): Promise<T[]> {
  const { excludeIds, metaCondition } = options;

  const jobs =
    ((await db.query.processes.findMany({
      where: and(
        eq(processes.key, processKey),
        or(eq(processes.status, "running"), eq(processes.status, "pending")),
        excludeIds ? not(inArray(processes.id, excludeIds)) : undefined,
        metaCondition ? metaCondition : undefined
      ),
    })) as T[]) ?? [];

  return jobs;
}

/**
 * Polls until there are no running/pending processes for the given key
 * (respecting optional excludeIds/metaCondition), or until timeout.
 * Does not publish abort messages itself — callers send abort events before calling.
 *
 * @param options.timeoutMs - Override default wait time (DEFAULT_WAIT_TIMEOUT_MS).
 * @param options.pollIntervalMs - Override default poll interval (DEFAULT_POLL_INTERVAL_MS).
 */
export async function waitForProcessesToAbort(
  db: Database,
  processKey: string,
  options: WaitOptions = {}
): Promise<void> {
  const {
    excludeIds,
    metaCondition,
    timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = options;

  const timeoutAt = Date.now() + timeoutMs;
  let iterations = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    iterations++;

    const jobs = await findRunningOrPendingProcesses(db, processKey, {
      excludeIds,
      metaCondition,
    });

    console.log(
      `waitForProcessesToAbort(${processKey}) iteration ${iterations}: found ${jobs.length} jobs`
    );

    if (jobs.length === 0) {
      return;
    }

    if (Date.now() >= timeoutAt) {
      throw new Error(
        `Jobs did not abort in time for key ${processKey} after ${iterations} iterations`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

