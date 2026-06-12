---
name: Coherent path + reach dates
overview: Dual £ track (observed vs model-coherent path), snap at as-of, backward scan for milestone reach timing; includes client projectToRetirement mutability contract.
todos:
  - id: schema-timepoint
    content: Extend ProjectionTimePoint (modelPathValue, projectedReachDate or equivalent) + JSDoc semantics
  - id: orchestrator-path
    content: modelPathValue on each point — backfill steps from prior observed value; snap at as-of; forward chains prior modelPathValue
  - id: backward-scan
    content: O(n) backward pass vs milestone target T; attach projectedReachDate per point or expose helper
  - id: wire-consumers
    content: Hook/badge lookback (e.g. 3 intervals) from baseline projection only — not preview/sliders
isProject: false
---

# Coherent model path + backward reach scan

## Goal

Support milestone-relative timing (e.g. “retire ~N months sooner” vs a lookback slot) using a **single coherent simulated trajectory** across backfill + forward, while **`value`** remains observed/historical for charts and £ deltas.

## Core mechanics (summary)

The second series is **not** a separate time series or endpoint — it is **an additional field on each existing `ProjectionTimePoint`** (same dates, same array order), alongside **`value`**.

1. **`value`** (observed): current semantics — historical/backfill and true as-of.
2. **`modelPathValue`** (additional field on the same time point), built along the same calendar grid:
   - **Backfill:** each step applies the same projection rules **`f`**, but the **starting balance for the interval** is the **previous time point’s observed `value`** (actual history), **not** the previous point’s `modelPathValue`. First backfill slot: set `modelPathValue` to that slot’s observed `value` (or agreed zero/missing rule). So the model path is “what our rules would produce **from what we actually had** last month,” month by month through history.
   - **As-of (`startDate`):** `modelPathValue = observed` (`value`) — snap to real NAV (should align with the last backfill step if the chain is consistent).
   - **Forward (after as-of):** each step uses **`f(previous `modelPathValue`, …)`** — there are no future actuals, so the chain continues on the model path only.
3. **Backward scan** on **`modelPathValue`** vs target **T** (milestone / FIRE number for that run) → optional **`projectedReachDate`** (also on each point, or derived in a helper from the array).
4. **Trade-off**: even with (2), **`modelPathValue[t]`** can still differ from **`value[t]`** in backfill when the model’s one-month step from **`value[t-1]`** ≠ what markets actually did by **`t`**; copy can explain that the second series is **rule-consistent from actual lags**, not a duplicate of observed £.

---

## Client `projectToRetirement` — mutable vs immutable

`projectToRetirement` runs in the **browser** for preview via [`useFirePreviewProjection`](client/src/hooks/use-fire-preview-projection.ts). Anything derived from **`modelPathValue` / `projectedReachDate`** must respect this contract.

### Immutable for client preview (locked to server baseline)

| Input | Source | Why |
|--------|--------|-----|
| **`startDate`** on projection config | `baseProjection.projectionResult.config.startDate` merged into the client’s `projectionConfig` | Keeps calendar grid, backfill window, and **as-of** aligned with the **server** snapshot so client preview does not “slide” the reference date. |

Code reference: `useFirePreviewProjection` builds `configToUse` with `startDate: lockedConfig.startDate` when `lockedConfig` exists.

### Mutable on client (preview / local recomputation)

| Input | Source | Effect |
|--------|--------|--------|
| **`fireConfig`** | e.g. `lastValidFirePreviewConfigRef` + form state | DOB, target age, income, SWR, etc. → **T** (`fireNumber`) and retirement horizon inputs **change** with preview. |
| **`projectionConfig`** (except enforced `startDate`) | `previewProjectionConfig` | Growth rate, modifiers, contribution scaler flags, etc. → **changes** `modelPathValue` recurrence and crossing date. |
| **`contributors`** | `computationContext.contributors` **plus** adjustment / account-type-offset contributors | Schedules and synthetic rows **change** forward path and totals. |

Server-provided contributor **payload** (including `valueHistory` for backfill) is **refetched** when the query invalidates; until then the client **extends** that list but should not assume new history without refetch.

### Requirements implied for this feature

1. **Recompute on every client run** — `modelPathValue` and backward reach outputs are **not** server-only artifacts; they must be produced inside the same pipeline as `orchestrateProjection` / `projectToRetirement` so **server and client** stay consistent given the same inputs.

2. **Same lock as today** — Any new pass that walks the grid must use the **same** `startDate` rule as preview (`lockedConfig.startDate`).

3. **“Vs 3 months ago” (decided)** — That metric is **only** meaningful **as of today** on the **saved plan** (no slider / preview adjustments). Implement it from **`currentProjection` / `baselineProjection`** only (`use-fire`’s server-backed result). It is **not** derived from **`activeProjection`** when preview is on; sliders do not affect it.

4. **Preview still recomputes full path** — Client `projectToRetirement` may still compute `modelPathValue` / reach for **preview** charts or other UI, but the **3‑month organic badge** stays wired to **baseline** data only.

5. **No DB on client** — Coherent path still uses only **in-memory** contributors/config already passed to `projectToRetirement`; no new client data sources.

6. **Determinism** — Given identical `fireConfig`, `projectionConfig` (including locked `startDate`), and `contributors`, server and client must yield the same `modelPathValue` / reach annotations (avoid time-dependent bugs except intentional `computedAt`).

---

## Implementation locus (unchanged from prior draft)

- Portfolio aggregation: [`projection-orchestrator.ts`](shared/utils/projection-orchestrator.ts) (or adjacent helper) after grid dates are known.
- Target **T**: from same milestone/FIRE inputs already used in [`projection-fire-calculator.ts`](shared/utils/projection-fire-calculator.ts).

## Suggested commits

Small, user-story style: schema → orchestrator coherent path + snap → backward scan → client hook/badge (3‑month delta from **baseline** only; preview badge remains separate where applicable).
