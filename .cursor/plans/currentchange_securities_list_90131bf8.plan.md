---
name: currentChange securities list
overview: Compute real day-over-day `currentChange` (£) and `currentChangePercentage` (%) for each asset security holding in the list, using the two most recent daily history records and existing TWR helpers.
todos:
  - id: fix-current-change
    content: In getResolvedUserAssetSecurities, fetch the 2 most recent daily history rows per holding and compute currentChange and currentChangePercentage using the TWR sub-period helper
    status: completed
isProject: false
---

# Compute `currentChange` for Asset Security Holdings List

## Scope

- **One file changed:** [`server/services/assets/database.ts`](server/services/assets/database.ts)
- **No client changes** — the UI already reads and displays `currentChange`
- **No schema changes** — `currentChange` and `currentChangePercentage` are already part of `CalculatedValue` in [`shared/schema/portfolio-assets.ts`](shared/schema/portfolio-assets.ts)

The computation is scoped to the **day-over-day current change per asset security holding** only.

---

## What Changes

Inside `getResolvedUserAssetSecurities`, replace the single `findFirst` for the latest history row with a `findMany` capped at 2, ordered descending by date. This gives `latestDay` (today's close) and `previousDay` (yesterday's close).

**Current (~line 654):**
```ts
const lastValue = await this.db.query.securityDailyHistory.findFirst({
  where: eq(securityDailyHistory.securityId, security.securityId),
  orderBy: (securityDailyHistory, { desc }) => [desc(securityDailyHistory.date)],
});
```

**Proposed:**
```ts
const [latestDay, previousDay] = await this.db.query.securityDailyHistory.findMany({
  where: eq(securityDailyHistory.securityId, security.securityId),
  orderBy: (securityDailyHistory, { desc }) => [desc(securityDailyHistory.date)],
  limit: 2,
});
```

---

## Computation

With `latestDay`, `previousDay`, and `totalShares = shareHoldings?.[0]?.sum ?? 0`:

- **`value`** (holding MV) = `latestDay.close × totalShares` — unchanged
- **`currentChange`** (£) = `(latestDay.close - previousDay.close) × totalShares` — `0` if no `previousDay`
- **`currentChangePercentage`** (%) = `twrSubPeriodReturn(previousMV, latestMV)` — uses the existing helper from [`shared/utils/portfolio-returns-twr.ts`](shared/utils/portfolio-returns-twr.ts)

Where:
- `previousMV = previousDay.close × totalShares`
- `latestMV = latestDay.close × totalShares`
- `twrSubPeriodReturn` computes `(latestMV / previousMV) - 1`, returns `null` if `previousMV` is zero — already handles the zero-guard

All arithmetic via `Decimal` (already imported). All outputs via `createDecimalValueString` (already imported).

---

## TWR Helper Reuse

`twrSubPeriodReturn` in `portfolio-returns-twr.ts` is purely abstract — despite the name it has no portfolio-specific coupling. Its signature:

```ts
twrSubPeriodReturn(startValue: Decimal, endValue: Decimal): Decimal | null
```

It is the correct tool for `currentChangePercentage` on a single holding: it is already written, tested, and handles all edge cases (zero start value, non-finite values).
