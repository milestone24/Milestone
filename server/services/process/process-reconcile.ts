/**
 * Callable reconciliation for stale process rows. Compares actual state (pending/running
 * with no recent activity) to desired state (terminal) and marks stale rows failed.
 * See docs/process-stale-jobs-industry-patterns.md §3 (Reconciliation loop).
 *
 * ## Implementation
 *
 * - **By job id:** When `jobId` is set, only that row is checked. Pending: stale if
 *   startedAt is older than pendingTtlMs. Running: stale if updatedAt is null or older
 *   than runningTtlMs (handlers touch the row via updateProcessStatus so updatedAt
 *   advances as a heartbeat).
 * - **By processKey / metaCondition:** When jobId is not set, all rows matching the key
 *   (and optional metaCondition) that are pending/running and past the TTL are marked failed.
 *   Used by routes or crons for key-wide sweeps.
 *
 * Services that create jobs (AssetValuesService, SecuritiesCacheService) call
 * startPeriodicReconciliationForResource with jobId after creating a job and invoking
 * the handler. That runs reconciliation for that job every RECONCILE_INTERVAL_MS until
 * RECONCILE_MAX_DURATION_MS, so a stuck job is marked failed per TTL without a separate
 * cron.
 *
 * ## TTL constraint
 *
 * Pending and running TTLs must be greater than other process-module timeouts so we do
 * not mark a job stale while it is still within normal windows: shutdown handler
 * (DEFAULT_SHUTDOWN_TIMEOUT_MS = 30s in server/utils/shutdown), wait-for-abort
 * (DEFAULT_WAIT_TIMEOUT_MS = 20s in process-abort-wait). See process-abort-wait.ts
 * for the full timeout overview.
 */
import { db } from "@server/db";
import { processes } from "@server/db/schema";
import type { SQL } from "drizzle-orm";
import { and, eq, inArray, lt } from "drizzle-orm";

/** Default TTL for pending jobs (startedAt older than this → stale). 5 min. */
export const DEFAULT_PENDING_TTL_MS = 5 * 60 * 1000;
/** Default TTL for running jobs (updatedAt older than this → stale). 15 min. */
export const DEFAULT_RUNNING_TTL_MS = 15 * 60 * 1000;

export type ReconcileOptions = {
  /** If set, only reconcile this job by id. When set, processKey/metaCondition are ignored. */
  jobId?: string;
  /** If set, only reconcile processes with this key. Ignored when jobId is set. */
  processKey?: string;
  /** Optional extra condition (e.g. payload ->> 'assetId' = $assetId) to scope reconciliation. Ignored when jobId is set. */
  metaCondition?: SQL;
  /** Pending jobs with startedAt older than this are marked failed. Default 5 min. */
  pendingTtlMs?: number;
  /** Running jobs with updatedAt older than this are marked failed. Default 15 min. */
  runningTtlMs?: number;
};

/**
 * Marks stale process rows as failed.
 *
 * When jobId is set: checks only that row. Pending → stale if startedAt &lt; now - pendingTtlMs.
 * Running → stale if updatedAt is null or &lt; now - runningTtlMs.
 * When jobId is not set: finds all rows for processKey (and optional metaCondition) that are
 * pending with startedAt past TTL or running with updatedAt past TTL, and marks them failed.
 *
 * @returns The number of rows updated.
 */
export async function reconcileStaleProcesses(
  options: ReconcileOptions = {}
): Promise<number> {
  const {
    jobId,
    processKey,
    metaCondition,
    pendingTtlMs = DEFAULT_PENDING_TTL_MS,
    runningTtlMs = DEFAULT_RUNNING_TTL_MS,
  } = options;

  const now = new Date();
  const pendingThreshold = new Date(now.getTime() - pendingTtlMs);
  const runningThreshold = new Date(now.getTime() - runningTtlMs);

  if (jobId) {
    const row = await db.query.processes.findFirst({
      where: eq(processes.id, jobId),
      columns: { id: true, status: true, startedAt: true, updatedAt: true },
    });
    if (!row) return 0;
    const stale =
      (row.status === "pending" && row.startedAt < pendingThreshold) ||
      (row.status === "running" &&
        (row.updatedAt === null || row.updatedAt < runningThreshold));
    if (!stale) return 0;
    await db
      .update(processes)
      .set({
        status: "failed",
        completedAt: now,
        error: "Stale: no activity within TTL (reconciliation)",
      })
      .where(eq(processes.id, jobId));
    return 1;
  }

  const basePending = and(
    eq(processes.status, "pending"),
    lt(processes.startedAt, pendingThreshold)
  );
  const baseRunning = and(
    eq(processes.status, "running"),
    lt(processes.updatedAt, runningThreshold)
  );
  let pendingWhere = processKey
    ? and(basePending, eq(processes.key, processKey))
    : basePending;
  let runningWhere = processKey
    ? and(baseRunning, eq(processes.key, processKey))
    : baseRunning;
  if (metaCondition) {
    pendingWhere = and(pendingWhere, metaCondition);
    runningWhere = and(runningWhere, metaCondition);
  }

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

/** Interval for periodic reconciliation runs. 5 min. */
export const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
/** Max duration to keep checking a created job. 1 hour. */
export const RECONCILE_MAX_DURATION_MS = 60 * 60 * 1000;

/**
 * Schedules periodic reconciliation for a created job so it is checked against the TTL
 * until it goes terminal or maxDurationMs elapses. Call after creating a job and invoking
 * the handler (trigger-and-forget). Use jobId so only this job is checked each run; if the
 * job is still pending/running with no recent activity (updatedAt/startedAt past TTL), it
 * is marked failed. The interval is cleared after maxDurationMs so we do not run indefinitely.
 *
 * @param options - ReconcileOptions; pass jobId for the created job and the TTLs.
 * @param intervalMs - How often to run reconciliation (default RECONCILE_INTERVAL_MS).
 * @param maxDurationMs - Stop the interval after this (default RECONCILE_MAX_DURATION_MS).
 */
export function startPeriodicReconciliationForResource(
  options: ReconcileOptions,
  intervalMs: number = RECONCILE_INTERVAL_MS,
  maxDurationMs: number = RECONCILE_MAX_DURATION_MS
): void {
  const intervalId = setInterval(() => {
    reconcileStaleProcesses(options).catch((err) => {
      console.error("Periodic reconciliation error", err);
    });
  }, intervalMs);

  setTimeout(() => {
    clearInterval(intervalId);
  }, maxDurationMs);
}
