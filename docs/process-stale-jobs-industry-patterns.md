# Industry patterns: event-driven distributed systems and stale jobs

This document summarises common design patterns for handling jobs (or processes) left in non-terminal states (e.g. stuck in "pending" or "running") in event-driven distributed systems. It supports discussion and design choices for process-module reconciliation and staleness detection (see the process module assessment plan, §3).

## Problem

In distributed systems, jobs can remain in a "processing" or "running" state when workers crash, lose communication, or hang. The queue may redeliver messages, but if the database still shows the job as in progress, the next worker may skip it or the system may never recover. The core invariant many patterns aim to protect: **a job is owned by at most one worker at a time**, and ownership must be recoverable when that worker disappears.

## 1. Ownership and last-activity (heartbeat) in the database

**Idea:** Treat the **database as the source of truth for job ownership**, not the queue. Each job row has:

- **`worker_id`** (or equivalent) — which worker owns it
- **`last_activity_at`** (or a timestamp like `updatedAt`) — when that owner last touched the row

**Recovery rule:** A job can be (re)claimed or marked failed if:

- It is queued and unowned, or
- The caller already owns it (re-entrancy), or
- **`last_activity_at` is older than a threshold** (e.g. 5 minutes) — previous owner is considered dead; job can be reclaimed or marked failed.

**References:** slepp.ca “Worker Heartbeats and Job Recovery”; BullMQ (lock + renewal); AWS SQS visibility timeout + extend.

**Relevance to our design:** Aligns with the idea of “touching” the row during the run so `updatedAt` (or a dedicated column) advances. One TTL (“no update in X”) then suffices for variable run length, without a fixed “max run time” from `startedAt`.

## 2. Heartbeat piggybacked on progress

**Idea:** Do not run a separate “I’m alive” timer. Every **progress update** (e.g. batch complete, record written) also updates `last_activity_at` / `updatedAt`. No progress ⇒ no update ⇒ after TTL the job is considered stale.

**Constraint:** Work must produce updates at least once per TTL (e.g. every 5 minutes). If there are long silent stretches, periodic no-op “touch” updates are needed.

**References:** slepp.ca (explicit); BullMQ (lock renewal during processing).

**Relevance to our design:** For asset-values (per-date) and securities-cache (per-security), we can touch the row after each chunk so `updatedAt` doubles as a heartbeat without extra machinery.

## 3. Reconciliation loop (desired vs actual state)

**Idea:** A **periodic or event-driven loop** that:

1. Reads desired state (e.g. “this job should be completed or failed”).
2. Reads actual state (e.g. `status`, `updatedAt`).
3. If actual diverges (e.g. still `running` with `updatedAt` older than now − TTL), **reconcile**: mark failed, re-queue, or reassign.

No single “job must finish in N minutes”; staleness is “no activity in N minutes”.

**References:** Kubernetes controller reconciliation; Mesos reconciliation; “Reconciliation Loop” pattern articles.

**Relevance to our design:** Our “reconciliation / stale-job sweep” is this pattern: a separate process or cron that finds non-terminal jobs that are stale (e.g. by `updatedAt`) and marks them failed or takes another agreed action.

## 4. Lock duration and renewal (BullMQ-style)

**Idea:** A job has a **lock** that expires after `lockDuration` (e.g. 30 seconds). The worker must **renew** the lock at least every `lockRenewTime` (e.g. half of `lockDuration`). If the worker does not renew (crash, blocked event loop), the job is **stalled** and can be moved back to waiting or failed.

**References:** BullMQ Stalled Jobs; JobRunr.

**Relevance to our design:** Conceptually the same as “ownership + last_activity”: “no renewal in X” ⇒ “no update in X”. We would implement by updating the DB row (and thus `updatedAt`) on a timer or on progress, and a reconciler treating “running and updatedAt &lt; now − TTL” as stalled.

## 5. SQS-style visibility timeout and extend

**Idea:** When a consumer takes a message, it is hidden for a **visibility timeout**. If processing is long or variable, the consumer **extends** visibility before it expires. If the consumer dies, it stops extending and the message becomes visible again (or a DLQ path is used).

**References:** AWS SQS documentation; “Beating heart of SQS” (heartbeat/extend).

**Relevance to our design:** Same idea as “extend while working”: we do not rely on a single long timeout from start; we keep proving liveness (e.g. by updating the row) so a single TTL can declare “stale” without cutting off long but healthy runs.

## 6. Startup reconciliation (optional)

**Idea:** When a **worker (or process) starts**, it finds jobs that were owned by **its previous instance** (e.g. same host/pid prefix) and still in `pending`/`running`, and clears or re-queues them so they do not wait for the full TTL.

**References:** slepp.ca “Startup reconciliation”.

**Relevance to our design:** In a single-process or fixed set of workers, we could on startup mark “my” stale rows failed or re-queue; in a fully trigger-and-forget or serverless model this is less central but still a valid refinement.

## Summary

| Pattern | How it addresses “stuck” jobs | Relation to our plan |
|--------|-------------------------------|------------------------|
| Ownership + `last_activity_at` in DB | Reclaim or fail when owner has not touched the row within TTL | Direct match to “touch row so `updatedAt` advances”; one TTL for variable duration. |
| Heartbeat piggybacked on progress | No separate heartbeat; progress updates = liveness | Touch row on each batch (date/security). |
| Reconciliation loop | Periodic/event-driven “desired vs actual” and fix drift | Our “stale-job sweep” / reconciliation. |
| Lock duration + renewal | Stale = no renewal in X; then treat as stalled | Same idea; we implement via DB row update + TTL. |
| Visibility timeout + extend | Long/variable work extends visibility; no extend ⇒ visible again / failed | Same “extend while working” idea via `updatedAt`. |

**Common theme:** **Liveness is “recent update,” not “started less than N ago.”** Industry practice therefore aligns with using **one TTL on “last activity”** (e.g. `updatedAt`) for running jobs, and optionally a separate (shorter) TTL for **pending** (“never started within X”).
