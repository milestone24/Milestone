import type { Database } from "@server/db";
import { processes } from "@server/db/schema";
import type { ProcessSelect } from "@shared/schema/process";
import type { SQL } from "drizzle-orm";
import { and, eq, inArray, not, or } from "drizzle-orm";

type FindOptions = {
  excludeIds?: string[];
  metaCondition?: SQL<unknown>;
};

type WaitOptions = FindOptions & {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

const DEFAULT_WAIT_TIMEOUT_MS = 20_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

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
 *
 * Does not publish abort messages itself — callers are responsible for
 * sending abort events before waiting.
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

