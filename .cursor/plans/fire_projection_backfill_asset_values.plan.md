---
name: FIRE projection backfill asset values
overview: Plan for fulfilling backfill with real historical asset values by giving contributors a value history; fetch is bounded (max backfill window), no reference date needed; grid backfill is populated from contributors' history.
todos: []
isProject: false
---

# FIRE projection backfill – asset values and design

## 1. Goal

Replace the placeholder backfill in projection (current value reused for past grid points) with **real historical values** from `asset_values`, and keep the design **elegant**—avoid messy, scattered "map asset values for backfill" logic.

---

## 2. Context: server vs client and who knows about the DB

- **projectRetirementWithContributors** – **Server only.** It uses the DB/data source (`getAssets`, `getFireSettings`, `getUserProfile`, etc.) to build contributors, then calls **projectToRetirement** with those contributors. It is the server entry that turns DB state into contributors.
- **projectToRetirement** – **Shared** (called from both server and client). It accepts only **fireConfig**, **projectionConfig**, and **contributors**. It does **not** call the DB or the data source. On the server it receives contributors from `projectRetirementWithContributors`; on the client it receives contributors that were already prepared on the server (e.g. via `projectionResult.computationContext` or similar). The client must know nothing of the DB—only the predefined contributors from the server.

So: DB access and "resolve contributors from DB" live in **projectRetirementWithContributors**; **projectToRetirement** stays a pure projection that works the same on server and client with pre-built contributors. Any backfill value resolution that needs the DB (e.g. `getAssetValueHistory`) must happen on the server, in code that has the data source—not inside **projectToRetirement**.

---

## 3. No reference date for asset values

Asset values in the DB only go up to **today**; that is presumed. When fetching historical values we are just reading what exists—the latest is today. So the data source API for backfill history does **not** need a reference date; it can return "last N interval boundaries" ending at today (or at the latest value date). E.g. `getAssetValueHistory(interval, maxIntervals)` returning values for the last maxIntervals intervals up to today.

---

## 4. Contributors carry history; grid backfill from contributors

**Do not** handle backfill separately from contributors. Reshape **contributors** so each has an optional **value history** for the backfill window (e.g. `valueByDate: Record<string, DecimalValueString>` keyed by date/interval). When building contributors in **projectRetirementWithContributors**, the server fetches asset value history for the last `MAX_BACKFILL_INTERVALS` (e.g. 24 months or 104 weeks) and attaches that history to each contributor. So each contributor has `currentValue` (for "today") and, when available, `valueByDate` for past dates in the backfill window.

The **backfill on the date grid** is then **populated from the contributors' history**: for each backfill date D, the projection sums (or looks up) each contributor's value at D from their history. No separate "backfill snapshots" or parallel structure—contributors are the single source; the grid reads from them.

- **projectRetirementWithContributors**: Replaces the call site with a single `getAssetsWithHistory(...)` call that returns assets plus bounded history. `getAssets()` stays in the data source unchanged for other flows. Maps assets to contributors and attaches each asset's history to the corresponding contributor. Passes contributors (with optional history) into **projectToRetirement**.
- **projectToRetirement** / orchestrator / **projection-simple**: Unchanged in terms of DB access. When filling backfill grid points: for each backfill date D, derive portfolio value at D from contributors (e.g. sum `contributor.valueByDate[dateKey(D)]` where present, else fall back to `currentValue` as placeholder). So backfill is **not** a separate flow—it is "read from contributors' history".
- **Client**: Receives contributors (with history when the server included it) e.g. in `computationContext`; **projectToRetirement** on the client uses the same contributor shape and populates grid backfill from contributor history. No DB on client.

---

## 5. Bounded fetch and single constant

- **MAX_BACKFILL_INTERVALS**: One constant (e.g. 24 for months, 104 for weeks). Used in two places: (1) when fetching in **projectRetirementWithContributors**—fetch history for the last N intervals (no reference date); (2) when building the grid / applying config—clamp `backfillIntervals` to this max so we never request more backfill than we have history for.
- **Data source**: Add `getAssetsWithHistory(...)` returning the same base asset shape as `getAssets()` plus per-asset history for the last `maxIntervals` interval boundaries up to today. Keep `getAssets()` in place. Implementation can still use the same SQL strategy ("latest value per asset per interval" over that window). Memory: 24 (or 104) values per asset; held only for the duration of the projection run.

---

## 6. Traceability for missing days and carry-forward

Because markets are closed on some days, required slot dates may not have an exact asset value. The strategy is:

- For each slot date `slotDate`, use the latest available value where `sourceValueDate <= slotDate`.
- In returned history, record both requested slot and selected source so provenance is explicit.

Recommended per-slot shape in the asset history payload:

- `slotDate`: The requested backfill/grid date.
- `value`: Value used for that slot.
- `sourceValueDate`: Actual `asset_values.value_date` chosen.
- `sourceType`: `"exact"` if `sourceValueDate === slotDate`, else `"carried_forward"`.
- `assetValueId` (optional): Underlying row id for row-level auditability.

This traceability is produced upstream in `getAssetsWithHistory(...)`; downstream projection logic should only consume these resolved values.

---

## 7. Summary


| Item                  | Action                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reference date**    | None. Asset values only go up to today; fetch "last N intervals" implicitly up to today.                                                    |
| **Contributors**      | Extend with optional `valueByDate` (or equivalent) for the backfill window. Server attaches history when building contributors.             |
| **Grid backfill**     | Populated from contributors' history (sum contributor value at each backfill date); no separate backfill structure.                         |
| **Data source**       | Add `getAssetsWithHistory(...)` and update call sites that need backfill history; keep existing `getAssets()` unchanged.                    |
| **Traceability**      | For each slot, include `slotDate`, `value`, `sourceValueDate`, `sourceType`, and optional `assetValueId`.                                  |
| **Constant**          | `MAX_BACKFILL_INTERVALS` used for fetch and for clamping `backfillIntervals` downstream.                                                    |
| **projection-simple** | For each backfill date, get portfolio value from contributors' `valueByDate` (or fallback to placeholder). No DB, no separate backfill API. |

---

## 8. Future configurability (developer note)

Current UI wording and behavior targets "vs last month" (one interval lookback).  
Future work should make this lookback window configurable (for example: 1 month, 3 months, 6 months), while keeping the same timeline-safe rules:

- Compare against a selected lookback slot derived from the same calendar-aligned grid.
- Use resolved historical values (exact or carried-forward), never today's value projected backward.
- If no source exists for an asset at the selected lookback slot, that asset contributes zero for that slot.

This is not part of the current feature scope; it is a planned extensibility point for developer tooling and future UI controls.


