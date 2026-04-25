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

### `asset_transactions` (account-level cash)

The **`asset_transactions`** table (per **`user_asset`**) is for **net money in and out of the account** in account currency: e.g. deposits, withdrawals, and other **external** movements at the account boundary. Per-instrument **buys and sells** are recorded under **`security_transactions`**.

- **Sign convention:** **`currencyValue`** is **positive** for inflows and **negative** for outflows (see `currency` on the row, usually GBP). These rows are the natural candidate for the **external cash-flow schedule** when pairing with portfolio market value for TWR/MWR, once total MV is defined to **include** cash in line with this model.

### Merged history and `transactionType`

For portfolio **transaction** time series, **`getCombinedAssetTransactionsWithBoundariesForAsset`** (see `server/services/assets/database.ts`) merges **`security_transactions`** and **`asset_transactions`**, ordered by `valueDate` (with a stable secondary key). Each row is tagged with **`transactionType`**: `security` | `asset` (see `shared/schema/transaction.ts`).

### Total market value and cash (calculated accounts)

For **`value_method = calculated`**, the stored and read **total** account value (latest **`currentValue`**, `asset_values` rows produced by the asset-value sync) is **securities (priced)** **plus** cumulative **`asset_transactions`** up to the relevant date. TWR and MWR **numerators and boundaries** (BMV, EMV, V⁻, V⁺) should use that **same** total, not a securities-only series.

### All-time “return” in `getPortfolioValueForUser`

- **`value`** uses **`calculatedAssetsQueryBuilder`**, so the total includes cash for **calculated** assets as above.
- **`returnValue`** still compares that total to **security** cumulative values only (see `getPortfolioValueForUser` in `server/services/assets/database.ts`); that ratio is **not** TWR and is unchanged by the cash work until product changes it.

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

## 6. Table-level rules for TWR and MWR *flows* (MVP)

The functions **`timeWeightedReturnFromSubPeriods`** and related types in [`shared/utils/portfolio-returns-twr.ts`](../shared/utils/portfolio-returns-twr.ts) are **pure math**: they expect **sub-periods with no internal flows** and a separate list of **dated external** amounts (`PortfolioReturnsTwrExternalFlow`). Likewise [`shared/utils/portfolio-returns-mwr.ts`](../shared/utils/portfolio-returns-mwr.ts) (**Modified Dietz**, IRR) takes **external** cash flows and portfolio values in a **consistent** sign convention. The **application** must **classify** which DB rows (or which derived net amounts per day) go into that external schedule.

**Default rules for the merged broker + cash model:**

| Table / `transactionType` | Role in the ledger | TWR / MWR *external flow* (typical) |
|----------------------------|--------------------|----------------------------------------|
| **`asset_transactions`** (`transactionType: 'asset'`) | Account-level **bank ↔ account** (and similar) cash movements. | **Yes** – treat as **net external** inflows/outflows in account currency, subject to the scope (e.g. one `user_asset` vs whole account vs consolidated portfolio). This is the **primary** source for a cash-flow schedule alongside total MV. |
| **`security_transactions`** (`transactionType: 'security'`) | Trades: **share** count and the **currency** leg of the trade. | **Usually no** at **consolidated** portfolio level *when* the economic story is: external money arrived via an **`asset_transaction`**, then moved **internally** from cash to the instrument. Then only the **asset** leg is an external TWR flow; the **security** leg is **internal** (the pair with cash is already reflected in MV). |
| **Single-leg security only** (e.g. a buy with **no** matching **`asset_transaction`**) | Still possible in data or during migration. | **Product call:** may be treated as **net external** for a period (similar to the older “every row is external” assumption) **or** imputed; misclassification breaks TWR. Prefer **two legs** (cash in + buy) when the product supports it. |

**Sign discipline:** keep **inflow positive / outflow negative** for external flows, aligned with **`asset_transactions.currencyValue`** and the MWR schema comments in `portfolio-returns-mwr.ts`.

**Valuation series:** any TWR or MWR built from **`asset_values`** (merged per [`resolveDayValueHistoryForAssetsForDateRange`](../shared/utils/assets.ts)) should use totals that **include** cash for **calculated** accounts, in line with §4.

---

## 7. Our current product assumption: external-only transactions

**Evolving product intent:** the canonical **external** cash movements for broker-style accounts are increasingly modeled as **`asset_transactions`**, with **`security_transactions`** representing **trades** that may be **internal** to the account once cash and securities are both tracked (see **§6**). A **legacy** or **shortcut** mode may still use **only** `security_transaction` lines with **no** separate cash row; TWR then needs an explicit product rule (often treating those rows as **net external** for lack of a better split).

**Implication for TWR:**

- **Classification** is explicit: use **`asset_transactions`** as the main **external** flow list; **do not** double-count a bank deposit in both **`asset_transactions`** and **`security_transactions`** at consolidated level.
- TWR is still **not** automatic: pair those flows with a **total** portfolio market value series (merged **`asset_values`**, including cash for calculated accounts) and handle **edge cases** (valuation changes without a transaction, multi-account scope, daily timing, single-leg security rows).

If we later track **more** internal legs (e.g. every cash ↔ fund move with full reconciliation), the rules in **§6** still apply: only **net external** capital splits the TWR timeline.

---

## 8. Summary table

| Topic | Note |
|--------|------|
| Range £ change | `portfolioOverview.currentChange` |
| Range % (existing, not TWR) | `portfolioOverview.currentChangePercentage` uses **`normalisePercentage`** on aggregated start/end |
| All-time % (cost-basis style) | `portfolioValue.returnValue` |
| TWR / MWR *math* | `shared/utils/portfolio-returns-twr.ts`, `shared/utils/portfolio-returns-mwr.ts` (pure; no DB) |
| TWR / MWR *flows* | **§6** – **`asset_transactions`** primary external; **`security`** usually internal at consolidated level when a cash leg exists |
| TWR *valuations* | Merged daily totals; **include** cash in MV for **calculated** accounts (§4) |

---

## 9. Related code references (for implementers)

- Portfolio value endpoint: `server/routes/assets.ts` → `getPortfolioValueForUser` / `getPortfolioOverviewForUser`
- Range returns (Modified Dietz + linked TWR): `GET /api/assets/portfolio-value/returns` → `getPortfolioRangeReturnsForUser` in `server/services/assets/database.ts` (uses `computePortfolioRangeReturns` in `shared/utils/portfolio-returns-range.ts`)
- Overview aggregation: `getPortfolioOverviewForAssets` in `shared/utils/assets.ts`
- Range change per asset: `calculateAssetsChange`, `resolveAssetWithChangeForDateRange`, `defineAssetValuesForDateRange` in `shared/utils/assets.ts`
- Daily portfolio history: `resolveDayValueHistoryForAssetsForDateRange`
- Daily transaction merge: `resolveDayTransactionHistoryForAssetsForDateRange`

---

*Last updated: cash in total MV (calculated) + merged `asset`/`security` history; TWR flow rules in §6.*
