/**
 * Callable reconciliation for stale process rows. Compares actual state (pending/running
 * with no recent activity) to desired state (terminal) and marks stale rows failed.
 * See docs/process-stale-jobs-industry-patterns.md §3 (Reconciliation loop).
 *
 * Callable by routes, crons, and by the services that create handlers (e.g. AssetValuesService,
 * SecuritiesCacheService) for their own process key. TTLs must be >> 30s (shutdown) and 20s
 * (wait-for-abort); see plan §3 "Existing timeouts".
 */
import { db } from "@server/db";
import { processes } from "@server/db/schema";
import { and, eq, inArray, lt } from "drizzle-orm";

const DEFAULT_PENDING_TTL_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_RUNNING_TTL_MS = 15 * 60 * 1000; // 15 min

export type ReconcileOptions = {
  /** If set, only reconcile processes with this key. */
  processKey?: string;
  /** Pending jobs with startedAt older than this are marked failed. Default 5 min. */
  pendingTtlMs?: number;
  /** Running jobs with updatedAt older than this are marked failed. Default 15 min. */
  runningTtlMs?: number;
};

/**
 * Marks stale process rows as failed. Finds pending rows with startedAt older than
 * pendingTtlMs and running rows with updatedAt older than runningTtlMs; sets
 * status to "failed", completedAt to now, and error to a short message.
 * Returns the number of rows updated.
 */
export async function reconcileStaleProcesses(
  options: ReconcileOptions = {}
): Promise<number> {
  const {
    processKey,
    pendingTtlMs = DEFAULT_PENDING_TTL_MS,
    runningTtlMs = DEFAULT_RUNNING_TTL_MS,
  } = options;

  const now = new Date();
  const pendingThreshold = new Date(now.getTime() - pendingTtlMs);
  const runningThreshold = new Date(now.getTime() - runningTtlMs);

  const basePending = and(
    eq(processes.status, "pending"),
    lt(processes.startedAt, pendingThreshold)
  );
  const baseRunning = and(
    eq(processes.status, "running"),
    lt(processes.updatedAt, runningThreshold)
  );
  const pendingWhere = processKey
    ? and(basePending, eq(processes.key, processKey))
    : basePending;
  const runningWhere = processKey
    ? and(baseRunning, eq(processes.key, processKey))
    : baseRunning;

  const stalePending = await db
    .select({ id: processes.id })
    .from(processes)
    .where(pendingWhere);

  const staleRunning = await db
    .select({ id: processes.id })
    .from(processes)
    .where(runningWhere);

  const ids = [
    ...stalePending.map((r) => r.id),
    ...staleRunning.map((r) => r.id),
  ];
  if (ids.length === 0) {
    return 0;
  }

  const result = await db
    .update(processes)
    .set({
      status: "failed",
      completedAt: now,
      error: "Stale: no activity within TTL (reconciliation)",
    })
    .where(inArray(processes.id, ids))
    .returning({ id: processes.id });

  return result.length;
}
