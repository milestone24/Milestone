---
name: Security Add Unification
overview: Audit all entry points where a security is added to an asset, unify the schemas and code paths, and implement a consistent approach including support for multiple initial transactions and a decision on the accumulative transaction concept.
todos:
  - id: audit-entry-points
    content: "Audit all entry points: document components, schemas, endpoints, and service methods for each"
    status: pending
  - id: accumulative-decision
    content: Discuss and resolve the accumulative transaction approach vs. alternatives before implementation
    status: pending
  - id: unified-schema-design
    content: Design the unified schema supporting optional multiple initial transactions
    status: pending
  - id: implement-unification
    content: "Phase 2: implement schema, service, route, and client changes identified in audit"
    status: pending
isProject: false
---

# Security Add to Asset — Unification

## Context
There are multiple places in the application where a security can be added to an asset. Each has grown independently, resulting in diverged schemas and code paths that all do fundamentally the same thing: link a security to an asset and optionally record an initial purchase.

This plan addresses that in two phases.

---

# Phase 1 — Audit

## Known Entry Points
1. **Asset creation wizard** — securities optionally added when creating a new asset
2. **Asset detail — securities list** — adding a new security to an existing asset via `AssetSecurityUpsertDialog` / `AssetSecurityNewForm`
3. **Security transaction dialog** — inline "add new security" introduced in the transaction dialog plan

Audit must also search the codebase for any additional entry points (e.g. OCR review, bulk import, API-key connected assets).

## For Each Entry Point, Record
- UI component(s) and hook(s) involved
- Schema / type used for the payload
- API endpoint called
- Server service method called
- Whether initial transactions are supported, and how many (currently all appear to support at most one via `initialHolding`)
- Whether `fundedFromCash` / cash outflow linkage is supported

## Design Principles to Apply in Phase 2
The unified schema must satisfy:

- **Initial transactions are optional** — linking a security to an asset must not require a transaction
- **Multiple initial transactions** — the schema must support zero, one, or many initial transactions per security add, replacing the current single `initialHolding` shape
- **`fundedFromCash` per transaction** — cash outflow linkage moves to be per-transaction rather than on the security link

## The "Accumulative" Transaction — Discussion Point
When setting up an existing account, a user may not want to enter every historical purchase. The proposal is an `accumulative` boolean flag on `security_transaction` that marks a transaction as representing an aggregated historical position rather than a single discrete purchase.

Questions to resolve before Phase 2 implementation:

- **Return calculations** — should accumulative transactions be excluded from time-series calculations (MWR/TWR) since they are not real dated cash flows?
- **Share balance** — they must still count toward current holdings
- **UI treatment** — should they render differently in transaction history?
- **Editability** — can a user later split an accumulative transaction into discrete ones?
- **Alternatives** — is a flagged transaction the right model, or would a `startingBalance` / prior cost basis field directly on `user_asset_securities` be cleaner?

## Deliverable
A written comparison across all entry points and a recommended unified schema and approach, with the accumulative question answered, before any implementation begins.

---

# Phase 2 — Implementation

## Scope
To be defined after the Phase 1 audit is complete and the accumulative question is resolved.

Expected changes will span:
- `shared/schema/portfolio-assets.ts` — unified "add security with optional transactions" schema
- `server/db/schema/portfolio-assets.ts` — possible `accumulative` column on `security_transactions` (if that approach is confirmed)
- `server/services/assets/database.ts` — unified `createUserAssetSecurity` accepting the new schema
- `server/routes/assets.ts` — endpoint accepting the new schema
- Client components — `AssetSecurityNewForm`, `AssetSecurityUpsertDialog`, asset creation wizard — all converging on the unified schema