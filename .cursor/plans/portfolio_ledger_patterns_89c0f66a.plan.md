---
name: Portfolio ledger patterns
overview: Survey of ledger patterns for cash + security postings, optional multi-leg bundles, compatibility with third-party direct purchases (standalone security postings, zero asset_transaction impact when appropriate), UI/API implications, MVP constraints—remodel OK, test-data migration only.
todos:
  - id: pick-pattern
    content: "Choose: bundle IDs vs journal/lines vs unified movements (and whether triggers vs app-only posting)."
    status: pending
  - id: scope-apis
    content: List which user flows must be atomic (manual sale, buy, transfer, import/OCR).
    status: pending
  - id: map-returns
    content: Define external vs internal classification for TWR/MWR under chosen pattern.
    status: pending
  - id: ui-contracts
    content: "For chosen pattern: API response shape(s), grouped vs flat activity list, edit/delete semantics."
    status: pending
  - id: direct-purchase-policy
    content: "Define security-only postings (no cash leg); external-flow tagging when platform has no omnibus cash; import flags."
    status: pending
isProject: false
---

# Industry patterns: cash vs investments in portfolio ledgers

Context: a **portfolio account** ([`user_assets`](server/db/schema/portfolio-assets.ts)) today stores **cash movements** in [`asset_transactions`](server/db/schema/portfolio-assets.ts) and **security lines** in [`security_transactions`](server/db/schema/portfolio-assets.ts). The concern is **economic events** that need **multiple legs** (e.g. sale → shares down, cash up) are not **one atomic posting**, so balances can drift unless users double-enter or integrations stay perfect.

Below are standard patterns, from most “accounting-native” to lighter-weight. All can be implemented in PostgreSQL with **one DB transaction** per user action when posting multiple rows **when** you intentionally create multiple legs.

---

## Third-party reality: direct purchases / sales with no meaningful cash holding

Integrated brokers and wrappers often let users **fund a buy or withdraw sale proceeds directly** via bank rails such that **the platform UI never exposes a resting cash balance**—money appears to move **straight** between bank and security. Your app still has to **visualise** imports that look like lone **fills** (`security_transactions` with `currencyValue`).

**Requirements this imposes:**

- **`security_transactions` alone must remain legitimate:** A buy or sell may **correctly have zero rows in [`asset_transactions`](server/db/schema/portfolio-assets.ts)** and **must not be forced into a synthetic cash pairing** unless the user or provider semantics call for one.
- **Portfolio value:** Continues to reconcile if **investment MV** drives the security side and **`asset_transactions` sum models only discretionary cash-on-platform** — total MV = securities (from valuations) **+** optional cash injections/withdrawals, which may legitimately omit “pass-through” bank↔fund flows duplicated as cash legs.
- **Bundles / `groupId`:** Must stay **optional**. Grouping binds **explicit** multi-leg events; **standalone** security rows are the default compatible pattern for direct-from-bank style activity.
- **Automatic cash inference (triggers, auto second legs):** Dangerous unless **gated by product flags** (`posting_style: passthrough_direct | omnibus_cash` per platform or per row). Blind “every sale credits cash” **breaks** direct-withdrawal narratives and double-count if the API already expresses economic cost in **`security_transactions.currency_value`** only.
- **Performance / cash-flow metrics:** [Range returns](docs/portfolio-time-weighted-return.md) and Modified Dietz need a **explicit rule**: for security-only postings, whether **external flow** attaches to **`security_transactions`**, **`asset_transactions`**, neither, or a **tag** — unchanged by bundling unless you classify **per leg or per event**.
- **UI:** Timeline must not show awkward “£0 cash” children; **single-line** trade presentation for standalone security postings; onboarding copy can explain why **cash holding** may read **£0** while trades still occur via third-party behaviour.

---

## 1. Double-entry journal (general ledger)

**Idea:** Treat the account as a small **GL**. Every posting is a **`journal_entry`** (header: date, memo, optional external id) with **2+ lines** that **sum to zero** in base currency (assets − liabilities − equity convention, or strictly balanced debits/credits).

- **Security line** and **cash line** are both **ledger lines** referencing the same journal.
- **Atomicity:** inserting the entry is one transaction; constraints (`CHECK` or trigger) enforce **balance = 0** per entry.

**Industry touchpoint:** How real books and many portfolio systems work internally.

**Remodel impact:** New tables (`journal_entries`, `ledger_lines` with `account_kind`: cash, security_position, income, etc.). Current tables become **views** or phased-out; or `security_transactions` / `asset_transactions` become **line types** migrated into one model.

**Third-party alignment:** Strict double-entry often needs an **explicit external / clearing line** so a “direct debit into fund” still balances. Alternatively, allow **`posting_kind = securities_only_trade`** journals with **implicit** external attribution (outside the account) — product must spell this out so **balanced journal** stays consistent with **no cash sub-ledger**.

**Fit for you:** Strong consistency and audit; more schema and UI work to expose “journal” vs “trade” views.

---

## 2. Transaction bundle / parent + legs (operational ledger)

**Idea:** Keep a familiar “trade” abstraction but add a **`ledger_group_id`** or **`event_id`** on both [`asset_transactions`](server/db/schema/portfolio-assets.ts) and [`security_transactions`](server/db/schema/portfolio-assets.ts) (your plan file already mentioned optional `leg_group_id`). All legs of one user action share the id; inserts happen in one DB transaction.

- **Atomicity:** application or DB constraint “all or nothing” for the group (or orphan detection job).

**Industry touchpoint:** Matches **OMS/broker** “order → fills → money movements** without full double-entry terminology.

**Remodel impact:** Minimal additive columns + posting rules; optional consolidation of APIs (“record sale” creates two rows with same group id).

**Third-party alignment:** Fits well if **`ledger_group_id` is nullable** — most imported rows remain **single-leg**; only internal two-step flows OR explicit “paired” sales get `group_id`. Composite APIs create **either** two rows **or** one row, never both inconsistently.

**Fit for you:** Smallest conceptual jump from current schema; matches MVP “pair legs” without rewriting everything.

**Later alignment (ISO 20022 / institutional feeds):** This pattern stays compatible if you adopt **ISO 20022-shaped** imports later: ISO defines **messages**, not your SQL; an **integration layer** maps each message (or linked trade + settlement confirmations) onto **one shared `ledger_group_id`** across the resulting [`asset_transactions`](server/db/schema/portfolio-assets.ts) / [`security_transactions`](server/db/schema/portfolio-assets.ts) rows. Store **external** references (**message Id**, lineage, instructed/settlement refs) on the bundle or on legs so **updates** don’t duplicate. One ISO lifecycle may yield **more than two** legs — bundles generalise beyond “sale + cash” when needed. Same group id can also tie **later** settlement rows to an **earlier** trade posting if that is how the feed arrives.

---

## 3. Single unified movements table (event-sourced lite)

**Idea:** One **`portfolio_movements`** (or `lot_events`) table: each row is an **effect** — `type` ∈ { `deposit`, `withdrawal`, `trade_buy`, `trade_sell`, … }, `amount_cash`, `quantity_security`, `security_link`, etc., with **`correlation_id`** grouping multi-row posts.

- **Atomicity:** multi-row insert per correlation id.

**Industry touchpoint:** Common in **event-sourced** or **activity feeds**; custodians sometimes expose “activities” as the truth.

**Remodel impact:** Largest—replace or heavily reshape [`security_transactions`](server/db/schema/portfolio-assets.ts); rebuild combined stream and accumulators in [`database.ts`](server/services/assets/database.ts) / [`query.ts`](server/services/assets/query.ts).

**Third-party alignment:** Prefer movement types **without mandatory** companion cash legs; `correlation_id` only when connectors emit **paired** custody events—otherwise **singleton** trades remain singleton rows.

**Fit for you:** Clean model long-term; highest migration + query rewrite cost for MVP.

---

## 4. Explicit cash instrument / sub-ledger (synthetic or real “CASH” leg)

**Idea:** Always model **cash as a position**—either a dedicated **`user_asset_cash`** balance table updated by triggers, or a **synthetic security** (your plan document’s “Approach A”). Trades post to **security** and **cash** in one transaction.

- Coupling can be **trigger-based** (“on `security_transactions` insert, adjust cash”) or **service-layer** only (weaker unless transactions wrap both).

**Industry touchpoint:** **Sub-ledger reconciliation** to a single “cash control” account.

**Remodel impact:** Medium; may avoid merging two tables mentally by **deriving** cash from one stream, or by **materialized** cash balance with invariants.

**Third-party alignment:** Automatic cash adjustment **contradicts** “no visible cash bucket” imports unless gated: either **disable** triggers for flagged sources, or reserve automated cash postings for platforms that **expose** omnibus cash. Otherwise prefer **standalone security rows** plus optional cash.

---

## 5. Trade date vs settlement date (two-phase)

**Idea:** Separate **trade** (position, contract) from **settlement** (when cash and/or securities legally **deliver** per market rules). Helps with **accuracy** and broker statements; does not by itself fix atomicity unless both phases are linked.

**Industry touchpoint (ISO 20022):** ISO 20022 is primarily a **financial messaging** standard—**structured business messages** (often **XML** with formal models) for **inter-institution** exchange (payments, securities settlement, reporting), not a **database or ORM modelling** standard. It does **not** prescribe your SQL tables. Referring to it here means your **app model** can reuse the **same lifecycle ideas** (trade date vs value/settlement date, status, parties)—especially if you later **import** custodian/broker feeds **or** raw ISO-shaped files—without requiring you to implement ISO parsers on day one. Whether a given integration is a **“broker”** in the **legal** sense is **jurisdiction-specific**; **product-wise**, connectors are **broker/custody-style** pipelines.

**Remodel impact:** Extra columns or child rows (e.g. `trade_date`, `settlement_date`, `settlement_status`) on [`security_transactions`](server/db/schema/portfolio-assets.ts) or an adjacent table; valuable if you import **real broker data** or want **reconciliation** timelines. Complements **bundles (§2)** when a **later** settlement message adds or updates legs tied to the **same** `ledger_group_id` via external references (see **Later alignment** under §2).

---

## Comparison axis for your MVP

| Pattern | Atomic multi-leg | Audit trail | Remodel depth | Notes |
|---------|------------------|------------|---------------|--------|
| Full double-entry | Strong | Strong | High | Best long-term ledger purity |
| Bundle / `leg_group_id` | Strong if enforced | Good | Low–medium | Aligns with existing two-table split |
| Unified movements | Strong | Good | High | One stream to query |
| Cash sub-ledger + triggers | Strong if DB-enforced | Medium | Medium | Risks conflicting with direct-purchase imports unless gated |
| Settlement split | Per phase | Strong for ops | Medium | orthogonal to “sale → cash” linkage |

---

## Fit for optional “no cash-flow effect” (evaluation)

This scores how naturally each pattern supports **standalone** security postings: **no** [`asset_transactions`](server/db/schema/portfolio-assets.ts) rows, **zero** change to **discretionary / omnibus cash** in the app’s model, yet **valid** position and portfolio figures (see [Third-party reality](#third-party-reality-direct-purchases--sales-with-no-meaningful-cash-holding)).

| Pattern | Fit | Rationale |
|---------|-----|-----------|
| **1. Double-entry journal** | **Medium** | A classic GL **wants lines to balance**. “No cash leg” is still fine if you allow a **non-posted** or **off–balance-sheet** external clear, or a **single-sided** trade line + **system clearing** / `posting_kind = external_only` — but you must **design** that explicitly; naïve rules (“every trade has cash + security lines”) **reject** securities-only. |
| **2. Transaction bundle (`leg_group_id`)** | **High** | **`group_id` null** = “not a bundle.” **Security-only** rows are already the default layout; optional group only when you **choose** to tie an [`asset_transactions`](server/db/schema/portfolio-assets.ts) leg. No schema change to the **existence** of standalone security rows beyond optional column + invariants on **grouped** rows only. |
| **3. Unified movements** | **High** if designed so | **Fit drops to Low** if the schema mandates `amount_cash` / companion row for certain `type`s. **High** when movement **`type`** encodes **`cash_effect: none`** (or nullable cash amounts) so **trade_buy** / **trade_sell** can stand alone without inventing phantom cash — same as singleton + optional `correlation_id`. |
| **4. Sub-ledger / synthetic CASH / triggers** | **Low → Medium** (gated) | The whole approach assumes **cash is mechanically updated by trades.** That **fight** security-only postings unless triggers are **disabled** or **intent flags** suppress cash updates for pass-through/direct flows. Fits only as **cash present** UX, not **zero cash footprint** by default. |
| **5. Trade vs settlement split** | **Orthogonal / Medium** | Does not decide whether **cash moves inside the portfolio**; only **when**. You can still have **sale with no resting cash**: e.g. **trade phase** recorded, settlement **straight to bank** with **no** internal cash leg — but you must avoid modelling that as **two** mandatory in-app legs. Helps **explain** broker timelines more than enforcing cash presence. |

**Takeaway:** For **maximum** accommodation of optional no cash effect with minimal migration, **optional bundles (#2)** and a **well-typed unified movements (#3)** model align best **if** invariant rules stop at bundled groups and do not require cash companions globally. **Double-entry (#1)** is workable but needs **explicit** product semantics for externally cleared trades. **Sub-ledger + automatic coupling (#4)** is the easiest to mis-specify vs direct-purchase semantics.

---

## UI / UX considerations by pattern

Cross-cutting goals: users should see **one primary story** per economic event (e.g. “Sold VWRL, +£X to cash”), with optional **drill-down** to legs; power users may still need a **raw leg list** for reconciliation. Response shape and list UI should match: **grouped** models favour **group-first** APIs or **client-side grouping** of a flat stream.

### 1. Double-entry journal (GL)

- **Mental model for users:** Either **journal-centric** (“Journal #42 — balanced entry”) or **activity-centric** with journals hidden (labels derive from line types). Most retail apps **hide** the journal and show friendly strings.
- **Response shapes:** Natural API is **`GET …/journal-entries/:id`** with `{ header, lines[] }`; list endpoint returns summaries `{ id, date, memo, netEffectSummary }` plus line count.
- **Activity list:** One **card row** per journal (“Deposit £500”, “Sold 10 × VWRL (journal)”) expanding to **line table** (account, debit/credit or signed amount)—similar to bank “transaction details”.
- **Create/edit:** Wizard posts **whole journal**; editing one leg may **re-open** the balanced editor. **Void/reverse** is often clearer than partial delete.

### 2. Transaction bundle (`correlation_id` / `leg_group_id` across existing tables)

- **Flat response (minimal API change):** Extend current combined row (e.g. [`flatCombinedTransactionRowSchema`](shared/schema/transaction.ts)) with optional `groupId`, `groupKind?: 'sale' | 'purchase' | …`. Clients **group rows** where `groupId` matches; singleton rows omit `groupId`.
- **Nested response (richer):** `GET …/transactions` returns `{ groups: [ { groupId, kind, valueDate, summary, legs: FlatCombinedRow[] } ], ungrouped: … }` or **two endpoints**: flat for graphs/exports, grouped for activity.
- **Activity list:** **Primary row** = one line per **group** (computed title from `groupKind` + first security): e.g. “Sale — VWRL” with subtitle “2 legs · −shares · +cash”. **Expand** shows two lines (security movement + cash) with **same date** emphasis.
- **Empty / partial states:** Must handle **orphan leg** (`groupId` set but sibling missing)—UI badge “Incomplete”; policy: block save at API or show repair flow.
- **Actions:** **Delete group** removes all legs (one confirm). **Edit** opens **structured form** (sale) rather than jumping to two unrelated edit screens unless “advanced split” is explicit.

- **Standalone security trade (third-party typical — no omnibus cash in app):** **One combined row**, no **`groupId`**, no expandable cash child; title from security + quantity and amount; optional subtitle “Direct from bank / no portfolio cash”. Same flat API as today; most rows stay **outside** bundles.

### 3. Single unified movements table

- **Mental model:** **Chronological activity feed** (broker-style)—each row already has **`type`**; multi-leg rare if you model composite as **one row with columns** or **few rows same correlation**.
- **Response shapes:** Pagination is trivially **stable** (`cursor` per row); grouping is identical to bundles if **`correlation_id`** ties multiple movement rows.
- **Activity list:** Easiest path to **single table** UI; filters by `type` without joining two physical tables. **Downside:** migrating from today’s two-table mental model in code and copy (“Contributions” vs “Securities” tabs may unify into **Activity**).
- **Detail:** Single-row detail suffices unless correlation spans rows.
- **Direct purchase / withdrawal:** Prefer movement `type`s that imply **cash_delta optional** (`trade_buy_bank_direct`) so feeds need not invent phantom cash rows.

### 4. Explicit cash instrument / synthetic CASH / sub-ledger

- **Holdings UX:** Adds a **Cash** line beside securities (TradingView-style) **or** only **dashboard totals** if cash is intentionally hidden—the product must choose to avoid duplicate perception (“cash twice”).
- **Activity list:** If cash is hidden as rows, users only see **security** lines; cash still updates implicitly—risk they **don’t trust** cash unless a **cash breakdown** drawer exists (**“Proceeds posted to cash”**).
- **Trigger-only updates:** Toughest UX story: users need **explicit feedback** (“Cash updated +£X from this trade”) tied to the security transaction id.

### 5. Trade date vs settlement date (two-phase)

- **Activity list:** **One expandable event** showing **trade date** and **settlement date**, or **two stacked sub-rows** with labels (“Trade”, “Settlement”) and a **timeline** cue.
- **Copy / confusion:** Clear labels needed (“Cash available on …”) to match broker expectations.
- **Imports:** UI for **matching** broker CSV lines to the same logical order.

### Cross-cutting API / UI notes

- **Charts / accumulators:** Grouped payloads may still need **flat time series** server-side—**don’t duplicate** calculation paths; graphs can consume **denormalised series** unchanged.
- **OCR / import:** Bulk insert should return **`groupIds`** created so the UI can show “Imported N events (M grouped)”.
- **Permissions / audit:** Grouped deletes need **single audit log entry** per user action referencing `groupId` or journal id.

---

## Interfaces you already depend on

Whatever pattern you pick, you will need to redefine how these stay correct:

- **Combined history / accumulators** — [`getCombinedAssetTransactionRowsForAsset`](server/services/assets/database.ts), CTEs in [`query.ts`](server/services/assets/query.ts).
- **Total MV including cash** — [`calculatedAssetCurrentValueSql`](server/services/assets/query.ts), [`addCashToCalculatedValueIfNeeded`](server/services/securities/sync/asset-value.ts).
- **Range returns / external flows** — [`getUserAccountAssetTransactionCurrencyFlows`](server/services/assets/database.ts) and [portfolio return docs](docs/portfolio-time-weighted-return.md) — classify **standalone security transactions** separately if **`asset_transactions` alone misses** economically external flows (see “Third-party reality” § above).

Bundles or journals should classify which legs count as **external flows** vs **internal** transfers for TWR/MWR (already discussed in your internal plan docs); **bundles optional** preserves security-only postings.

---

## Recommended direction for discussion (not a decision)

1. **Short term MVP:** **Optional posting groups** (`correlation_id` / `leg_group_id` — nullable) plus composite APIs where the product wants **paired** cash+security; **do not** migrate every historical **standalone** [`security_transactions`](server/db/schema/portfolio-assets.ts) row into a bundle—imports from third-party “direct purchase” semantics stay single-leg unless the connector maps an explicit omnibus cash model.
2. **If you want ledger-grade invariants:** evolve toward **journal_entry + lines** or a **unified movements** table in a second phase after flows stabilize, still documenting **explicit** handling of **outside-the-account** clearing for securities-only postings.

No code or migrations until you choose a pattern and scope; test-data migration only reduces risk.
