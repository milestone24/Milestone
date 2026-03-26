---
name: React Query UX Optimisation
overview: Audit and optimise the React Query configuration to improve UX across the app — fixing broken cache invalidations, tightening query key correctness, and introducing optimistic updates, placeholder data, and prefetching where appropriate.
todos:
  - id: fix-session-loader
    content: "commit: [session] should not show full-screen loader on background window-focus refresh — gate INITIAL_USER_LOADING dispatch in use-session.ts queryFn to first-load only (files: use-session.ts, ProtectedRoute.tsx)"
    status: pending
  - id: fix-securities-cache-key
    content: "commit: [securities sync] should invalidate correct asset history cache key — replace URL string with shared assetValues key in use-securities-update.ts (files: use-securities-update.ts)"
    status: pending
  - id: fix-asset-graph-key
    content: "commit: [asset graph] should scope cache entry per asset — add assetId to assetGraphValues query key in pages/asset.tsx (files: pages/asset.tsx)"
    status: pending
  - id: fix-enabled-guards
    content: "commit: [transactions] should not fetch without a valid assetId — add enabled: !!assetId to use-asset-transactions.ts and use-security-transactions.ts (files: use-asset-transactions.ts, use-security-transactions.ts)"
    status: pending
  - id: fix-dead-hook
    content: "commit: [securities search] should remove duplicate broken hook — delete use-securities-search.ts (files: use-securities-search.ts)"
    status: pending
  - id: config-gctime
    content: "commit: [query config] should evict cache by data class lifetime — configure gcTime per-hook for reference data vs volatile data (files: use-broker-platforms.ts, use-broker-providers.ts, use-fire-settings.ts, use-assets.ts, use-projections.ts)"
    status: pending
  - id: config-placeholder-data
    content: "commit: [query config] should keep previous data visible during date-range refetch — add placeholderData keepPreviousData to all date-range-parameterised query hooks (files: use-assets.ts, use-portfolio-overview.ts, use-portfolio-transactions.ts, use-asset-values.ts, use-asset-transactions.ts, pages/asset.tsx, pages/portfolio.tsx)"
    status: pending
  - id: optimistic-asset-crud
    content: "commit: [asset list] should reflect create and update immediately — add optimistic updates to use-asset-create.ts and use-asset-update.ts with onMutate/rollback pattern (files: use-asset-create.ts, use-asset-update.ts)"
    status: pending
  - id: optimistic-recurring-contributions
    content: "commit: [recurring contributions] should reflect changes immediately — add optimistic updates to all 4 mutations in use-recurring-contributions.ts (files: use-recurring-contributions.ts)"
    status: pending
  - id: optimistic-security-transactions
    content: "commit: [security transactions] should reflect changes immediately — add optimistic updates to all 3 mutations in use-security-transactions.ts (files: use-security-transactions.ts)"
    status: pending
  - id: prefetch-static-data
    content: "commit: [app boot] should prefetch static reference data — prefetch broker platforms and providers on app initialisation (files: App.tsx or queryClient.ts)"
    status: pending
  - id: prefetch-on-hover
    content: "commit: [portfolio navigation] should prefetch asset data on hover — prefetch portfolioAssets and per-asset data on nav/row hover (files: relevant nav and list components)"
    status: pending
  - id: draft-hook
    content: "commit: [form drafts] should provide sessionStorage-backed draft state utility — implement useDraftState hook (files: client/src/hooks/use-draft-state.ts)"
    status: pending
  - id: draft-add-account
    content: "commit: [add account] should preserve wizard state if user leaves mid-flow — apply useDraftState to AccountCreate formStage and RHF values (files: components/account/AccountCreate.tsx)"
    status: pending
  - id: draft-fire-contributors
    content: "commit: [fire contributors] should preserve draft state if user leaves mid-flow — apply useDraftState to FireContributionsCard and FireContributorAndWithdrawalCard (files: components/fire/FireContributionsCard.tsx, components/fire/FireContributorAndWithdrawalCard.tsx)"
    status: pending
isProject: false
---

# React Query UX Optimisation

Audit and optimise React Query configuration to improve perceived performance and correctness of cache invalidation across the app.

## Current State Summary

- Global config: `staleTime: Infinity`, `retry: false`, `refetchOnWindowFocus: false`, `refetchInterval: false`
- Strategy is fully manual cache invalidation — all updates depend on `invalidateQueries` in mutation `onSuccess` or socket messages
- No optimistic updates, no prefetching, no `gcTime` configured, no `select` transforms

## Phase 1 — Bug Fixes (correctness before optimisation)

These are silent failures that undermine any UX work built on top.

### 1.0 Window-focus session refetch triggers full-screen loader and unmounts all children (HIGH PRIORITY)

**This is the direct cause of the dialog state loss the user experiences.**

**Trace:**

```
refetchOnWindowFocus fires (after staleTime: 10min)
  → queryFn dispatches INITIAL_USER_LOADING unconditionally
  → SessionContext sets isInitialUserLoading = true
  → ProtectedRoute renders full-screen spinner instead of children
  → All child components (including open dialogs and their form state) unmount
  → Session check completes → INITIAL_USER_LOADED dispatched
  → Children re-mount with all useState reset — dialog gone
```

**Files:** `[client/src/hooks/use-session.ts](client/src/hooks/use-session.ts)` (line 60), `[client/src/components/ProtectedRoute.tsx](client/src/components/ProtectedRoute.tsx)`

**Fix:** The `queryFn` should only dispatch `INITIAL_USER_LOADING` when there is genuinely no existing user in the cache (i.e., truly the first load). Window-focus refetches should update the session silently without triggering the loading state. A simple guard using `queryClient.getQueryData(["user"])` before the dispatch achieves this.

### 1.1 Broken cache key in `use-securities-update.ts`

- Invalidates `[`/assets/${assetId}/history`]` — does not match real key `["asset","history","values", assetId]`
- Fix: replace with `[...assetValues, assetId]` from `@shared/api/queryKeys`

### 1.2 `pages/asset.tsx` — missing `assetId` in query key

- Uses `[...assetGraphValues, startDate, endDate]` without `assetId`
- Multiple assets would share the same cache entry
- Fix: add `assetId` as a segment in the key

### 1.3 Missing `enabled` guards

- `use-asset-transactions.ts` — no `enabled: !!assetId`
- `use-security-transactions.ts` — no `enabled: !!assetId`
- Fix: add `enabled` option to both

### 1.4 Dead code: `use-securities-search.ts`

- Duplicates `use-find-securities.ts` and has no return statement
- Fix: remove the file

## Phase 2 — Configuration Tuning

### 2.1 `gcTime` configuration

- File: `[client/src/lib/queryClient.ts](client/src/lib/queryClient.ts)`
- Currently unset (library default: 5 minutes)
- Proposal: set a considered `gcTime` per data class via per-hook override, not globally, since reference data (broker platforms, fire settings) can live longer than volatile data (portfolio values, projections)

### 2.2 `placeholderData: keepPreviousData` for date-range queries

- Hooks affected: `use-assets.ts`, `use-portfolio-overview.ts`, `use-portfolio-transactions.ts`, `use-asset-values.ts`, `use-asset-transactions.ts`, `pages/asset.tsx`, `pages/portfolio.tsx`
- When the user changes the date range, these queries re-run and show a loading state — `keepPreviousData` keeps the old chart data visible until the new data arrives

## Phase 3 — Optimistic Updates

Currently all mutations wait for server confirmation before updating the UI.

### 3.1 Asset CRUD (`use-asset-create.ts`, `use-asset-update.ts`)

- High-value: asset list is visible while creating/editing
- Pattern: `onMutate` → `cancelQueries` → `setQueryData` with provisional entry → rollback in `onError`

### 3.2 Recurring contributions (`use-recurring-contributions.ts`)

- 4 mutations (add/edit/delete/toggle) — all update the same list
- Optimistic list patch on each mutation

### 3.3 Security transactions (`use-security-transactions.ts`)

- 3 mutations — same pattern

### 3.4 FIRE settings (`use-fire-settings-create.ts`, `use-fire-settings-patch.ts`)

- Lower priority (settings page, not a list)

## Phase 4 — Prefetching

- No prefetching exists anywhere today
- Candidates:
  - Prefetch `portfolioAssets` when the user hovers/focuses the Portfolio nav link
  - Prefetch `[...asset, assetId]` when user hovers an asset row
  - Prefetch broker platforms/providers on app boot (they never change)

## Phase 5 — Form Draft Persistence (Dialog State Survival)

### Problem

If a user is mid-way through a data-entry dialog and switches to another app or webpage to retrieve information (e.g. a broker account number, a security ISIN, a valuation figure), they risk losing their progress in the following scenarios:

- **Mobile (Capacitor)**: OS may suspend or kill the app, unmounting all components
- **In-app navigation**: user clicks a link within the app to look something up, navigating away from the page hosting the dialog
- **Accidental refresh**: browser or OS-triggered page reload

> Note: simply switching browser tabs does **not** lose state since React components remain mounted — this is a mount/unmount or refresh problem.

### Affected Flows (by severity)


| Flow                              | Component                                                           | Why high risk                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Add Account (3-step wizard)       | `AccountCreate.tsx`                                                 | `formStage` (1–3) + all RHF values; user must look up broker name, account number, and optionally link a security — all from external sources |
| Screenshot Upload                 | `ScreenshotUpload.tsx`                                              | Multi-step with extracted row data in many `useState` fields; loss means re-uploading                                                         |
| Add FIRE Contributor / Withdrawal | `FireContributionsCard.tsx`, `FireContributorAndWithdrawalCard.tsx` | Draft state held in raw `useState` fields (not RHF)                                                                                           |
| Security transaction entry        | `SecurityTransactionUpsertDialogue.tsx`                             | Requires price/quantity lookup                                                                                                                |


### Approach

Introduce a `useDraftState` utility hook in `client/src/hooks/use-draft-state.ts`:

```typescript
useDraftState<T>(key: string, defaultValue: T): [T, (val: T) => void, () => void]
// setter auto-persists to sessionStorage; third return value is clearDraft()
```

- Uses `sessionStorage` (survives tab switches, cleared on browser close — appropriate for transient form drafts)
- Key is namespaced per dialog, e.g. `draft:add-account`
- Draft is cleared on explicit cancel or successful submit

For **RHF-based flows** (`AccountCreate`), pair `useDraftState` with a lightweight debounced `form.watch()` subscriber to sync field values to the draft, and `form.reset(draft)` on mount if a draft exists. Also persist `formStage` alongside form values in the same draft entry.

For **raw `useState` flows** (`FireContributionsCard` etc.), `useDraftState` replaces the relevant `useState` calls directly.

### Scope for this plan

- Implement `useDraftState` hook
- Apply to `AccountCreate` (highest priority — 3-step wizard)
- Apply to `FireContributionsCard` / `FireContributorAndWithdrawalCard`
- `ScreenshotUpload` deferred (highly complex — separate ticket)

## Commit Strategy

One commit per todo item, in order. Each commit is self-contained and independently releasable.

### Phase 1 — Bug fixes

1. `[session] should not show full-screen loader on background window-focus refresh`
2. `[securities sync] should invalidate correct asset history cache key`
3. `[asset graph] should scope cache entry per asset`
4. `[transactions] should not fetch without a valid assetId`
5. `[securities search] should remove duplicate broken hook`

### Phase 2 — Config tuning

1. `[query config] should evict cache by data class lifetime`
2. `[query config] should keep previous data visible during date-range refetch`

### Phase 3 — Optimistic updates

1. `[asset list] should reflect create and update immediately`
2. `[recurring contributions] should reflect changes immediately`
3. `[security transactions] should reflect changes immediately`

### Phase 4 — Prefetching

1. `[app boot] should prefetch static reference data`
2. `[portfolio navigation] should prefetch asset data on hover`

### Phase 5 — Form draft persistence

1. `[form drafts] should provide sessionStorage-backed draft state utility`
2. `[add account] should preserve wizard state if user leaves mid-flow`
3. `[fire contributors] should preserve draft state if user leaves mid-flow`

