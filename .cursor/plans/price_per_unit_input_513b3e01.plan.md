---
name: Price Per Unit Input
overview: Add a "Price Per Unit" field to both security forms alongside the existing "Currency Value" field. The currency value is derived as shares × price per unit, displayed as read-only text, and submitted with the form. Both pricePerUnit and the derived currencyValue are sent to the server.
todos:
  - id: db-schema
    content: "Add nullable perUnitValue: brandedDecimal column to securityTransactions table in portfolio-assets.ts; run db:push"
    status: completed
  - id: schema-transaction
    content: "Update securityTransactionOrphanInsertSchema: add pricePerUnit field; keep currencyValue (now derived client-side)"
    status: pending
  - id: schema-portfolio
    content: "Update userAssetSecurityInitialHoldingSchema: add pricePerUnit field; keep currencyValue (now derived client-side)"
    status: pending
  - id: server-derive
    content: Populate perUnitValue at both insertion sites in database.ts using the submitted pricePerUnit value
    status: pending
  - id: form-transaction
    content: "In AssetSecurityTransactionSingleForm: remove currencyValue input, add pricePerUnit input, show derived currencyValue as read-only text, set currencyValue in form data from shares × pricePerUnit"
    status: pending
  - id: form-new-security
    content: "In AssetSecurityNewForm (AssetSecurityNewFields): remove initialHolding.currencyValue input, add initialHolding.pricePerUnit input, show derived currencyValue as read-only text, set currencyValue in form data from shares × pricePerUnit"
    status: pending
isProject: false
---

# Price Per Unit Input

Replace the `currencyValue` input field in both security forms with a `pricePerUnit` input. The `currencyValue` is derived client-side as `shares × pricePerUnit`, shown as read-only text, and still included in the submitted form data. The server receives both fields and continues to store `currencyValue` as the source of truth for aggregations.

## Scope

Two entry points, both affected the same way:

- [`AssetSecurityTransactionSingleForm`](client/src/components/account/AssetSecurityTransactionSingleForm.tsx) — remove "Currency Payment" input, add "Price Per Unit" input, display derived total as text
- [`AssetSecurityNewForm`](client/src/components/account/AssetSecurityForm.tsx) — remove "Currency Value" input, add "Price Per Unit" input, display derived total as text

## Schema Changes

### `shared/schema/transaction.ts`
- `securityTransactionOrphanInsertSchema`: add `pricePerUnit: decimalValueNonZeroSchema`; keep `currencyValue` (it will be derived and set client-side before submission)

### `shared/schema/portfolio-assets.ts`
- `userAssetSecurityInitialHoldingSchema`: add `pricePerUnit: decimalValueNonZeroSchema`; keep `currencyValue` (derived client-side)

## Server Changes

### [`server/services/assets/database.ts`](server/services/assets/database.ts)

Two insertion sites need updating to populate `perUnitValue`:

**Security transaction insert (~line 1340):**
```ts
// Add alongside existing currencyValue
perUnitValue: data.pricePerUnit,
```

**Initial holding insert (~line 2545):**
```ts
// Add alongside existing currencyValue
perUnitValue: data.initialHolding.pricePerUnit,
```

`currencyValue` at both sites continues to use the value submitted by the client (already derived as `shares × pricePerUnit`).

## Client Changes

### `AssetSecurityTransactionSingleForm.tsx`
- Remove the `currencyValue` `FormField` input
- Add a `pricePerUnit` `FormField` input (label: "Price Per Unit", same numeric input pattern)
- Watch `value` (shares) and `pricePerUnit`; derive `currencyValue = shares × pricePerUnit`
- Display the derived `currencyValue` as read-only text (e.g. "Total: $1,234.56")
- Set `currencyValue` on the form via `setValue` whenever either watched field changes

### `AssetSecurityForm.tsx` (`AssetSecurityNewFields`)
- Remove the `initialHolding.currencyValue` `FormField` input
- Add an `initialHolding.pricePerUnit` `FormField` input (label: "Price Per Unit")
- Watch `initialHolding.shareHolding` and `initialHolding.pricePerUnit`; derive `currencyValue`
- Display the derived `currencyValue` as read-only text
- Set `initialHolding.currencyValue` on the form via `setValue` whenever either watched field changes

## Prerequisites

`perUnitValue` has been added as a nullable `brandedDecimal` column to `securityTransactions` in `server/db/schema/portfolio-assets.ts`. **You must run `npm run db:push` (drizzle-kit) to apply the migration before the server insertion of `perUnitValue` will take effect.**

## What does NOT change

- `currencyValue` in `security_transactions` stays and continues to drive all window function aggregations
- All read/display paths (transaction lists, history) are unaffected
- The `AssetSecurityEditForm` (edit existing holding) is not affected

---

*Stage 1: additive — both currencyValue and pricePerUnit coexist in schemas and the DB.*
