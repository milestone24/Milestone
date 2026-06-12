---
name: Session-Capability DB Plan
overview: Clarify and de-risk the whole server/db module design so connection creation, capability declaration, and session usage are explicit and safe for temp-table workflows.
todos:
  - id: map-db-capabilities
    content: Define and document capability matrix for current DB runtime paths (transaction vs pinned-session).
    status: pending
  - id: design-capability-gating
    content: Specify capability-based replacement for `isLocalDb` and module-level execution paths across all DB exports.
    status: pending
  - id: redesign-db-module-contract
    content: Define explicit `server/db/index.ts` module contract (factory return shape, runtime metadata, exported APIs, and invariants).
    status: pending
  - id: validate-temp-table-boundaries
    content: Confirm all temp-table operations stay fully inside `withConnection` session scope.
    status: pending
  - id: agree-neon-runtime-path
    content: Decide Neon session-capable runtime/client approach before coding.
    status: pending
isProject: false
---

# Server DB Module Capability Strategy

## Objective

Align the `server/db/index.ts` module with explicit capability-driven behavior so temp-table usage, transactions, and session checkout are deterministic and safe in Neon/local environments.

## Current Problem (Confirmed)

- `[server/db/index.ts](/Users/digozi/Projects/activeProjects/Milestone/Milestone/server/db/index.ts)` gates `withConnection(...)` by `isLocalDb` (`localhost|127.0.0.1`) instead of session capability.
- The module mixes driver selection, runtime assumptions, and exported typing in ways that hide execution-path differences.
- `[server/services/securities/sync/asset-value.ts](/Users/digozi/Projects/activeProjects/Milestone/Milestone/server/services/securities/sync/asset-value.ts)` depends on session-scoped temp-table flow (`createTempTableForAssetValues -> insert staging -> merge -> drop`).
- Result: Neon remote path is blocked even when runtime/client configuration might support session behavior.

## Discussion-First Plan

1. **Document runtime/client capabilities explicitly**
  - Define what each runtime path guarantees: stateless query, transaction support, pinned-session support.
  - Distinguish "transaction works" from "temp-table-safe session pinning".
2. **Redesign `server/db/index.ts` module contract**
  - Split concerns into explicit parts: endpoint classification, client/pool creation, Drizzle instance creation, capability declaration.
  - Return a typed runtime contract from factory (db + capability metadata + session access primitives).
  - Ensure exported symbols reflect contract instead of implicit driver assumptions.
3. **Refactor design for capability-based execution paths**
  - Replace host-based `isLocalDb` decisioning with explicit capability flags from module setup.
  - Model at least:
    - `supportsTransactions`
    - `supportsSessionConnection` (required by `withConnection` and temp tables)
    - `connectionMode` (`direct` | `pooled` | `unsupported`)
4. **Redesign `withConnection` contract**
  - Keep `withConnection` as the single session-scoped abstraction.
  - Implement explicit branches:
    - direct path: use direct session-capable client path.
    - pooled path: checkout with `pool.connect()` and `release()` in `finally`.
    - unsupported path: hard-fail with capability diagnostics.
  - Hard-fail only when `supportsSessionConnection === false`, with precise diagnostic message.
5. **Audit all temp-table callsites**
  - Verify all temp-table operations are contained within `withConnection` boundaries.
  - Ensure no temp-table logic escapes session scope in process/distributed handlers.
6. **Operational observability before rollout**
  - Add startup/runtime diagnostics logging selected DB mode + capability flags.
  - Add targeted runtime error context for asset-values job failures (driver/capability metadata).
7. **Decision gate before implementation**
  - Confirm preferred Neon runtime/client strategy for session-capable path.
  - Then implement minimal code changes in `server/db/index.ts` and keep business logic untouched.

## Verification Checklist (Before Any Code Change)

- Confirm endpoint class from `DATABASE_URL` host:
  - `-pooler` host = pooler endpoint (not suitable for session-scoped temp-table assumptions).
  - non-`-pooler` host = direct endpoint (required baseline for session features).
- Confirm runtime driver/client path in code (not assumption by URL params):
  - Whether DB is instantiated from an explicit `Pool` object vs URL-only helper.
  - Whether `withConnection` acquires a real client via `pool.connect()` and always releases in `finally`.
- Confirm capability semantics explicitly:
  - `supportsTransactions` can be true while `supportsSessionConnection` is false.
  - Temp-table workflows require `supportsSessionConnection === true`.
- Confirm no reliance on fragile internals:
  - Remove/avoid dangerous casts like `(db as unknown as { $client: Pool }).$client` as source of truth.
  - Keep a typed, explicit pool reference from connection factory for session checkout.

## Scope Guardrails

- No asset-value business logic changes.
- No migration to persistent staging table in this phase.
- No test-writing in this phase unless requested.

## Primary Files For Follow-up

- `[server/db/index.ts](/Users/digozi/Projects/activeProjects/Milestone/Milestone/server/db/index.ts)`
- `[server/services/securities/sync/asset-value.ts](/Users/digozi/Projects/activeProjects/Milestone/Milestone/server/services/securities/sync/asset-value.ts)`
- `[server/services/process/asset-values-distributed-handler.ts](/Users/digozi/Projects/activeProjects/Milestone/Milestone/server/services/process/asset-values-distributed-handler.ts)`

