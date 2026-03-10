# Processes Module

A comprehensive guide to the process module in `server/services/process/`. This module orchestrates background jobs for asset value updates and securities cache population, using a trigger-and-forget pattern with DB state and queue events for coordination and distributed readiness.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Process Types](#4-process-types)
5. [Core Components](#5-core-components)
6. [Services](#6-services)
7. [Distributed Handlers](#7-distributed-handlers)
8. [Queue & Messaging](#8-queue--messaging)
9. [Lifecycle & State Machine](#9-lifecycle--state-machine)
10. [Abort & Shutdown Flow](#10-abort--shutdown-flow)
11. [Reconciliation & Staleness](#11-reconciliation--staleness)
12. [Update Chain](#12-update-chain)
13. [API & Entry Points](#13-api--entry-points)
14. [Configuration & Environment](#14-configuration--environment)
15. [Related Documentation](#15-related-documentation)

---

## 1. Overview

The process module provides:

- **Job orchestration** for long-running asset value and securities cache updates
- **Trigger-and-forget** handler invocation — handlers run asynchronously; callers rely on queue events and DB state for completion
- **Cooperative cancellation** via Abort signals and queue-based abort messages
- **Graceful shutdown** integration so jobs can abort cleanly before process exit
- **Staleness detection** via periodic reconciliation and TTL-based marking of stuck jobs

### Design Principles

- **Database as source of truth** — job state lives in the `processes` table; queue events are for coordination and notifications
- **Cache-first strategy** — securities cache must be populated before asset values can be computed
- **Single ownership per resource** — at most one running/pending job per asset or security at a time; new jobs abort existing ones

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Entry Points (API / Triggers / DB Asset Service)                            │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Services (AssetValuesService, SecuritiesCacheService)                       │
│  - Insert process row (pending)                                              │
│  - Find existing running/pending jobs                                        │
│  - Publish abort events for existing jobs                                    │
│  - waitForProcessesToAbort()                                                 │
│  - Invoke handler (trigger-and-forget)                                       │
│  - startPeriodicReconciliationForResource()                                  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Distributed Handlers (asset-values, securities-cache)                       │
│  - Register shutdown handler                                                 │
│  - Subscribe to queue for abort messages                                     │
│  - Create updater (AssetValuesUpdater / SecuritiesCacheUpdater)              │
│  - Update DB status + publish queue events on lifecycle events               │
│  - await using jobScope for cleanup                                          │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Updaters (securities/sync/asset-value.ts, cache.ts)                         │
│  - EventEmitter: started, completed, failed, aborted, exited                 │
│  - AbortSignal + shouldContinue() for cooperative cancellation              │
│  - Touch process row at batch boundaries (heartbeat)                         │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Queue (Local / SQS)                                                        │
│  - Publish: lifecycle events, abort requests                                 │
│  - Subscribe: initUpdateChain (chain.ts) listens for completion/failure     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### `processes` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key, auto-generated |
| `key` | text | Process type: `update-asset-values` or `update-securities-daily-history-cache` |
| `status` | enum | `pending` \| `running` \| `completed` \| `failed` \| `aborted` |
| `startedAt` | timestamp | When the job was created |
| `completedAt` | timestamp | Set when status becomes terminal (completed, failed, aborted) |
| `supersededBy` | uuid | Optional reference to a replacement job |
| `payload` | jsonb | Type-specific data (accountId, assetId, startDate, securityId, groupId, etc.) |
| `results` | jsonb | Reserved for future use |
| `references` | jsonb | Reserved for future use |
| `error` | text | Error message when status is `failed` or reconciliation marks stale |
| `createdAt` | timestamp | Row creation time |
| `updatedAt` | timestamp | Last activity; advances on `updateProcessStatus` (heartbeat) |

### Constraints

- `status_completed_or_failed_or_aborted_has_completed_at`: `completedAt` must be non-null when status is terminal; must be null otherwise.

### Schema Location

- `server/db/schema/processes.ts`

---

## 4. Process Types

### 4.1 `update-asset-values`

**Purpose:** Recompute and persist asset values for a given asset over a date range.

**Payload:**
```ts
{
  accountId: string;
  assetId: string;
  startDate?: Date;
}
```

**Scope:** One job per asset at a time. New job for same asset aborts existing running/pending jobs.

**Entry points:** `AssetValuesService.updateAssetValuesForAssetOfAccount`, `checkGroupCompleteAndTriggerAssetValues`, `updateAssetValuesForAllAssetsOfAccount`, `updateAssetValuesForAllAssetsOfAllAccounts`.

### 4.2 `update-securities-daily-history-cache`

**Purpose:** Populate `securityDailyHistory` for one or more securities.

**Payload (per-security):**
```ts
{
  securityId: string;
  startDate: Date;
  groupId?: string;
  accountId?: string;
}
```

**Payload (full refresh):**
```ts
{
  date: Date;
}
```

**Scope:** One job per security at a time for per-security jobs; one global job for full refresh.

**Entry points:** `SecuritiesCacheService.updateSecuritiesDailyHistoryCacheForSecurity`, `updateSecuritiesDailyHistoryCacheForSecurities`, `updateSecuritiesDailyHistoryCacheForAllSecurities`.

---

## 5. Core Components

### 5.1 `process-abort-wait.ts`

**Purpose:** Find running/pending jobs and wait for them to abort before starting a replacement.

**Exports:**
- `findRunningOrPendingProcesses<T>(db, processKey, options?)` — Finds processes with status `running` or `pending`. Options: `excludeIds`, `metaCondition` (e.g. `payload ->> 'assetId' = $assetId`).
- `waitForProcessesToAbort(db, processKey, options?)` — Polls until no running/pending jobs remain (respecting excludeIds/metaCondition) or timeout.

**Defaults:**
- `DEFAULT_WAIT_TIMEOUT_MS` = 20s
- `DEFAULT_POLL_INTERVAL_MS` = 5s

**Process status semantics:**
- **pending:** Job row created; handler may not have been invoked yet or has not emitted "started".
- **running:** Handler has started; `updateProcessStatus` has been called with "running".

### 5.2 `job-helpers.ts`

**Purpose:** Shared helpers for distributed handlers.

**Exports:**
- `updateProcessStatus(jobId, status, errorMessage?)` — Updates DB; sets `completedAt` for terminal states. Errors are caught and logged (not rethrown) to support trigger-and-forget.
- `shouldContinue(abortSignal, { jobId? })` — Returns `false` if signal is aborted or job is terminal; used for cooperative cancellation.
- `createAbortCompletionPromise(jobId)` — Returns `{ promise, resolve }`. Call `resolve()` after abort sequence; internally polls DB until status is `aborted` before resolving. Sized to fit within `DEFAULT_SHUTDOWN_TIMEOUT_MS`.
- `waitForTerminalEvent(emitter)` — Resolves when emitter fires `completed`, `failed`, `aborted`, or `exited`.

### 5.3 `job-scope.ts`

**Purpose:** Async disposable for handler scope cleanup.

**Exports:**
- `createJobScope(cleanup)` — Returns `AsyncDisposable`. Use with `await using jobScope = createJobScope(...)` so `unregisterShutdown` and `unsubscribe` run when scope exits.
- `JobScopeCleanup` — `{ unregisterShutdown, unsubscribe }`.

### 5.4 `process-reconcile.ts`

**Purpose:** Mark stale process rows as failed.

**Exports:**
- `reconcileStaleProcesses(options)` — Marks jobs stale when:
  - **By jobId:** Pending: `startedAt` older than `pendingTtlMs`; Running: `updatedAt` null or older than `runningTtlMs`.
  - **By processKey/metaCondition:** All matching rows that are stale.
- `startPeriodicReconciliationForResource(options, intervalMs?, maxDurationMs?)` — Schedules `reconcileStaleProcesses` every `intervalMs` until `maxDurationMs`.

**Defaults:**
- `DEFAULT_PENDING_TTL_MS` = 5 min
- `DEFAULT_RUNNING_TTL_MS` = 15 min
- `RECONCILE_INTERVAL_MS` = 5 min
- `RECONCILE_MAX_DURATION_MS` = 1 hour

**TTL constraint:** TTLs must be greater than shutdown timeout (30s) and wait-for-abort timeout (20s) so we do not mark jobs stale during normal shutdown or wait windows.

---

## 6. Services

### 6.1 `AssetValuesService` (`asset-values.ts`)

**Responsibilities:**
- Create and run asset value update jobs
- Coordinate with securities cache (cache must be populated first)
- Abort existing jobs for same asset before starting new one
- Trigger asset values update when cache group completes

**Key methods:**
- `initAssetValuesForAssetOfAccount(accountId, assetId)` — Ensures securities cache is populated for asset; asset-values update is triggered when cache group completes.
- `updateAssetValuesForAssetOfAccount(accountId, assetId, startDate?)` — Main flow: insert job, find existing jobs, publish abort, wait, invoke handler, start reconciliation.
- `updateAssetValuesForAllAssetsOfAccount(accountId, startDate?)` — Iterates assets; currently filtered for a specific asset (dev filter).
- `updateAssetValuesForAllAssetsOfAllAccounts(startDate?)` — Iterates accounts; currently filtered for a specific account (dev filter).
- `checkGroupCompleteAndTriggerAssetValues(groupId)` — When all cache jobs in group are terminal, triggers asset-values update. Special `groupId: "full-refresh"` triggers update for all assets of all accounts.
- `sendAssetValuesInvalidatedNotification(accountId, assetId)` — Sends WebSocket notification and invalidates React Query keys.

**Static:** `FULL_REFRESH_GROUP_ID = "full-refresh"`.

### 6.2 `SecuritiesCacheService` (`securities-cache.ts`)

**Responsibilities:**
- Create and run securities daily history cache update jobs
- Same abort-wait pattern as AssetValuesService

**Key methods:**
- `updateSecuritiesDailyHistoryCacheForSecurity(securityId, groupId?, accountId?, startDate?)` — Single security job.
- `updateSecuritiesDailyHistoryCacheForSecurities(securityIds, groupId?, accountId?, startDate?)` — Parallel jobs per security.
- `updateSecuritiesDailyHistoryCacheForAllSecurities()` — Full refresh; single job; fails if any cache job already running.

---

## 7. Distributed Handlers

### 7.1 `asset-values-distributed-handler.ts`

**Event:** `{ assetId, accountId, jobId, startDate? }`

**Flow:**
1. Create `AbortController` and `createAbortCompletionPromise(jobId)`.
2. Register shutdown handler: signals abort, awaits `abortCompletePromise`.
3. Load job from DB; subscribe to queue for `asset-values-update-abort` messages.
4. `await using jobScope` — cleanup on exit.
5. Create `AssetValuesUpdater` with `updateProcessStatus` and `shouldContinue` callbacks.
6. Attach updater events: `started`, `completed`, `failed`, `aborted`, `exited`; each updates DB and publishes queue message.
7. On `aborted`: `updateProcessStatus`, publish, `resolveAbort()`.
8. `updater.update()`; `await waitForTerminalEvent(updater)`.

### 7.2 `securities-cache-distributed-handler.ts`

**Event:** `{ jobId }` — payload is read from DB.

**Flow:** Same structure as asset-values handler; uses `SecuritiesCacheUpdater` and securities-cache-specific queue events.

### 7.3 `asset-values-mock-lambda.ts`

**Purpose:** Mock Lambda entrypoint for local/emulated distributed runs. Awaits handler; returns `{}`. For production Lambda, wire to queue trigger.

---

## 8. Queue & Messaging

### Queue Service (`server/services/distributed/queue.ts`)

**Factory:** `factory()` — Returns `LocalQueueService` (EventEmitter) or `SQSQueueService` based on `QUEUE_TYPE`.

**Message types:**
- **Asset values:** `asset-values-update-abort`, `started`, `completed`, `failed`, `aborted`, `exited`
- **Securities cache:** `securities-daily-history-cache-update-abort`, `started`, `completed`, `failed`, `aborted`, `exited`

**Type guards:** `isAssetValuesUpdateMessage`, `isSecuritiesDailyHistoryCacheUpdateMessage`.

---

## 9. Lifecycle & State Machine

```
                    ┌──────────────┐
                    │   (insert)   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   pending    │
                    └──────┬───────┘
                           │ handler started
                           ▼
                    ┌──────────────┐
                    │   running    │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  completed   │  │   failed     │  │   aborted    │
  └──────────────┘  └──────────────┘  └──────────────┘
         (terminal)
```

- **pending → running:** When updater emits `started`.
- **running → completed/failed/aborted:** Terminal events from updater or external abort.
- **Reconciliation:** Can mark `pending` or `running` as `failed` when stale (TTL exceeded).

---

## 10. Abort & Shutdown Flow

### Shutdown (SIGTERM/SIGINT)

1. Shutdown coordinator (`server/utils/shutdown.ts`) receives signal.
2. Handler registered by distributed handler runs: `abortController.abort()`.
3. Updater receives abort via `AbortSignal`; emits `aborted`.
4. Handler: `updateProcessStatus(jobId, "aborted")`, publish queue message, `resolveAbort()`.
5. `resolveAbort()` runs `checkAborted()` — DB poll until status is `aborted`.
6. `abortCompletePromise` resolves; shutdown handler completes.
7. `jobScope` disposes: unregister shutdown, unsubscribe from queue.

**Timeouts:**
- `DEFAULT_SHUTDOWN_TIMEOUT_MS` = 30s (coordinator)
- `createAbortCompletionPromise` poll: 1s interval, max tries = `DEFAULT_SHUTDOWN_TIMEOUT_MS / 1000` (30)

### External Abort (Queue Message)

1. Another process publishes `asset-values-update-abort` or `securities-daily-history-cache-update-abort` with `jobId`.
2. Handler's queue callback receives and calls `abortController.abort()`.
3. Same flow as shutdown abort from step 3 onward.

### Wait for Abort (Before Starting Replacement)

1. Service publishes abort for each existing job.
2. `waitForProcessesToAbort` polls DB until no running/pending jobs remain (or timeout).
3. Default: 20s timeout, 5s poll interval.

---

## 11. Reconciliation & Staleness

**Problem:** Trigger-and-forget means a job can stay `pending` (handler never started) or `running` (handler died mid-run) indefinitely.

**Solution:** Periodic reconciliation (see `process-reconcile.ts` and `docs/process-stale-jobs-industry-patterns.md`).

**Per-job reconciliation:** After creating a job and invoking the handler, services call `startPeriodicReconciliationForResource({ jobId, pendingTtlMs, runningTtlMs })`. Every 5 min, `reconcileStaleProcesses` checks that job; if stale, marks it `failed` with error `"Stale: no activity within TTL (reconciliation)"`. Stops after 1 hour.

**Heartbeat:** Updaters call `updateProcessStatus` at batch boundaries (e.g. per date, per security). This advances `updatedAt`, acting as a heartbeat.

**Staleness rules:**
- **Pending:** `startedAt` older than `pendingTtlMs` (5 min).
- **Running:** `updatedAt` null or older than `runningTtlMs` (15 min).

---

## 12. Update Chain

**File:** `server/services/distributed/chain.ts`

**Initialization:** `initUpdateChain()` is called on server startup (after DB ping).

**Flow:** Subscribes to queue and reacts to:
- `asset-values-update-started` — Send notification.
- `asset-values-update-completed` — Invalidate cache, send notification, `sendAssetValuesInvalidatedNotification`.
- `asset-values-update-failed` — Send notification.
- `securities-daily-history-cache-update-completed/failed/aborted` — If `groupId`, call `checkGroupCompleteAndTriggerAssetValues(groupId)`.
- `securities-daily-history-cache-update-exited` — Call `updateAssetValuesForAllAssetsOfAllAccounts`.

---

## 13. API & Entry Points

### Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/asset-values-update` | POST | Trigger asset values update for all assets of all accounts |
| `/api/securities-daily-history-cache-update` | POST | Trigger full securities cache refresh |

**Auth:** `requireApiKey`, `requireScope("trigger")`.

### Tracking Routes

- `GET /api/processes` — List processes (with query params).
- `GET /api/processes/:processId` — Get single process.

### Programmatic

- `DatabaseAssetService` — Uses `AssetValuesService` for asset value updates when assets change.
- `initUpdateChain` — Subscribes to queue on startup.

---

## 14. Configuration & Environment

| Variable | Purpose |
|----------|---------|
| `DISTRIBUTED` | `"true"` — Use mock Lambda for asset-values; otherwise local handler |
| `QUEUE_TYPE` | `"distributed"` — Use SQS; otherwise local EventEmitter |
| `AWS_REGION` | SQS region (default `eu-west-2`) |
| `SQS_QUEUE_URL` | SQS queue URL when distributed |

---

## 15. Related Documentation

- **`docs/process-stale-jobs-industry-patterns.md`** — Industry patterns for stale job handling (ownership, heartbeat, reconciliation).

---

## File Reference

| File | Purpose |
|------|---------|
| `asset-values.ts` | AssetValuesService |
| `asset-values-distributed-handler.ts` | Asset values handler |
| `asset-values-mock-lambda.ts` | Mock Lambda entrypoint |
| `securities-cache.ts` | SecuritiesCacheService |
| `securities-cache-distributed-handler.ts` | Securities cache handler |
| `process-abort-wait.ts` | Find/wait for running/pending jobs |
| `process-reconcile.ts` | Staleness reconciliation |
| `job-helpers.ts` | Status update, shouldContinue, abort promise, terminal wait |
| `job-scope.ts` | Async disposable for cleanup |
