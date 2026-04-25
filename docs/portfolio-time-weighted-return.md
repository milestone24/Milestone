# Portfolio returns, overview data, and time-weighted return (TWR)

This document captures how portfolio return metrics work in the application today, what **time-weighted return** requires, what data we have in the codebase, and how that aligns with our **current product assumption** that recorded transactions represent **external** money only (not internal buys/sells).

---

## 1. Portfolio page metrics today

On the portfolio page, the header combines two API responses:

### `GET /api/assets/portfolio-value` (`usePortfolioValue`)

- **`value`**: Current total portfolio value (sum of latest values per asset). **Not** filtered by the UI date range.
- **`returnValue`**: An **all-time**, **cost-basis-style** ratio computed server-side as  
  \((\text{total current value} / \text{sum of latest accumulative transaction values}) \times 100\).  
  See `getPortfolioValueForUser` in `server/services/assets/database.ts`.  
  This does **not** change when the user changes the date range.

### `GET /api/assets/portfolio-overview?…` (`usePortfolioOverview(startDate, endDate)`)

- Scoped to the **same date range** as the chart (via `getUserAssetsWithAccountValueChange` → `resolveAssetsWithChange` / range-aware history).
- Returns a **`ValueChange`** aggregate: `startValue`, `value`, **`currentChange`** (GBP), **`currentChangePercentage`**, plus range dates.

The UI can bind **£ change over the period** to **`currentChange`**. Any **percentage** that should move with the range should **not** use **`portfolioValue.returnValue`** unless we intentionally keep an all-time number there.

### How `currentChangePercentage` is defined (not TWR)

Per asset, range change uses **`calculateAssetsChange`** on value history inside the range (with synthetic boundaries where needed). The stored **`currentChangePercentage`** uses **`normalisePercentage(start, end)`**:

\[
\frac{\text{end} - \text{start}}{\text{end}} \times 100
\]

(See `shared/utils/assets.ts` and tests in `shared/utils/assets-calculatateAssetsChange.test.ts`.)

Portfolio-level **`currentChangePercentage`** in **`getPortfolioOverviewForAssets`** applies that same function to **aggregated** start and end totals—not a sum of per-asset percentages.

This is **not** time-weighted return, **not** \((\text{end}-\text{start})/\text{start}\), and **not** the same formula as all-time **`returnValue`** (cost-basis ratio).

---

## 2. Date-range sensitive “return %”: implementation options (discussion)

These options were evaluated for making a **percentage** move with the date range without committing to TWR:

1. **Surface existing `currentChangePercentage`**  
   - **Pros**: No new API; aligned with range and existing server aggregation.  
   - **Cons**: Metric is **`normalisePercentage`** on portfolio totals (unusual vs textbook “return since start of period”); differs from all-time **`returnValue`**.

2. **Define a simple period return on start value**  
   e.g. \((\text{end} - \text{start}) / \text{start} \times 100\) using aggregated **`startValue`** / **`value`**, or **`currentChange` / startValue**.  
   - **Pros**: Easier to explain as “return over the selected period.”  
   - **Cons**: Product decision; handle **`startValue === 0`**; still not TWR if there are flows within the period.

3. **Range-scoped analogue of `returnValue` (cost-basis over period)**  
   - **Pros**: Conceptual consistency with all-time cost-basis **return**.  
   - **Cons**: Requires a clear spec (what counts as basis in-range, deposits, withdrawals, multi-account); more work.

4. **TWR (or MWR / IRR)**  
   - **Pros**: Standard interpretation for “performance independent of when cash moved” (TWR).  
   - **Cons**: Needs reliable **external cash flows** and **portfolio valuations** at flow dates; see below.

---

## 3. What time-weighted return (TWR) needs

At **portfolio** level, classic TWR:

1. Splits the analysis window at times of **external** cash flows (money **into** or **out of** the measured portfolio from **outside**).
2. Computes a return on **market value** for each sub-period so that **new money does not inflate or deflate** performance the way a simple total return can.
3. **Geometrically links** those sub-period returns.

So TWR needs:

- A **portfolio market value** time series (or at least valuations **immediately before and after** each flow, plus period start/end), with an agreed **timing convention** if data is **daily** only.
- A **schedule of external flows**: date, amount, and consistent sign (e.g. inflow positive, outflow negative).

It does **not** follow from “we have transactions with dates and amounts” alone unless those rows are **exactly** the external boundary crossings for the portfolio scope we measure.

---

## 4. What data we have in the codebase (valuation + activity)

### Portfolio value through time (range-aware)

We build a **daily** combined total by merging per-asset **`asset_values`** histories:

- `streamAssetValuesForDateRange` → `getCombinedDayValuesForValues` → `resolveDayValueHistoryForAssetsForDateRange` in `shared/utils/assets.ts`.

That yields **one total per calendar day** when updates occur, with **synthetic** start/end points for a requested range when there is no exact observation—important for charts and for boundary valuations.

### Transaction history (merged daily)

We also merge transaction streams for charting:

- `resolveDayTransactionHistoryForAssetsForDateRange`  
- Transactions carry **`valueDate`**, **`currencyValue`**, **`accumulativeAssetCurrencyValue`**, **`transactionType`** (`asset` | `security` | `synthetic`), etc. (`shared/schema/transaction.ts`).

### All-time “return” in `getPortfolioValueForUser`

Uses total current value vs **sum of latest accumulative transaction values** per asset—**not** the same as TWR or **`currentChangePercentage`**.

---

## 5. “Cash-flow identity and classification” (why it matters in general)

**Cash-flow identity** means: *which movements are **net external capital** into/out of the portfolio we are measuring?*

**Classification** means: *for each event, does it count as such a flow, with what sign and magnitude, especially when aggregating multiple accounts?*

Even when **every row has a date and amount**, many systems record:

- **Buys / sells** with cash **already inside** the account → **not** new money from outside for whole-portfolio TWR.
- **Dividends, fees, reinvestment** → treatment depends on definition.
- **Transfers between accounts** → at **consolidated** portfolio level may net to **zero** external flow even if two accounts each show a transaction.

If **every** transaction were misclassified as external, TWR would **mis-adjust** for flows that are really **internal reshuffling** and the number would **not** be a standard TWR.

**Accuracy limits even with good intent:**

- **Daily** marks only → sub-period boundaries use a **convention** (e.g. flow at close), not intraday precision.
- **Manual** or **imported** valuation jumps **without** a matching external transaction → can look like **performance** unless modeled.
- **FX**: transactions include **`currency`**; portfolio aggregation must be consistent.

---

## 6. Our current product assumption: external-only transactions

**Current product intent:** we are **not** tracking internal legs (e.g. cash ↔ instrument trades inside an account). Recorded transactions represent **money from outside** entering the portfolio or leaving **to** outside.

**Implication for TWR:**

- The **classification problem is much smaller**: each transaction row is a strong candidate for an **external cash flow** for the scope we measure, with correct sign convention.
- TWR is still **not** automatic: we must pair those flows with a **portfolio market value series** (e.g. merged **`asset_values`**) and handle **edge cases** (valuation changes without a transaction, multi-account scope, daily timing).

If this assumption ever changes (e.g. full broker-style internal trade history), TWR would again require explicit rules for which rows are **external** vs **internal**.

---

## 7. Summary table

| Topic | Note |
|--------|------|
| Range £ change | `portfolioOverview.currentChange` |
| Range % (existing, not TWR) | `portfolioOverview.currentChangePercentage` uses **`normalisePercentage`** on aggregated start/end |
| All-time % (cost-basis style) | `portfolioValue.returnValue` |
| TWR | Needs external **flows** + **valuations** at boundaries; daily series is workable with clear conventions |
| Our transactions | Treated as **external-only** today → good fit for the **flow** side of TWR if valuations are aligned |

---

## 8. Related code references (for implementers)

- Portfolio value endpoint: `server/routes/assets.ts` → `getPortfolioValueForUser` / `getPortfolioOverviewForUser`
- Overview aggregation: `getPortfolioOverviewForAssets` in `shared/utils/assets.ts`
- Range change per asset: `calculateAssetsChange`, `resolveAssetWithChangeForDateRange`, `defineAssetValuesForDateRange` in `shared/utils/assets.ts`
- Daily portfolio history: `resolveDayValueHistoryForAssetsForDateRange`
- Daily transaction merge: `resolveDayTransactionHistoryForAssetsForDateRange`

---

*Last updated from product and engineering discussion; extend this doc when return definitions or transaction modeling change.*
