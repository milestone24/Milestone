---
name: Decimal Precision Fix
overview: Add a `brandedDecimalQuantity` helper (scale 8) for share quantities, update `brandedDecimal` to scale 4 for monetary values, update all hardcoded `decimal(18, 2)` SQL casts, and enforce 8dp limit on share quantity inputs via Zod refinement and HTML step attribute.
todos:
  - id: db-schema-only
    content: "Task 1 (DB only): Update brandedDecimal scale to 4, add brandedDecimalQuantity helper (typed as DecimalValueString temporarily), switch securityTransactions.value to brandedDecimalQuantity in portfolio-assets.ts. User runs db:push and tests migration before proceeding."
    status: completed
  - id: brand-types
    content: "Task 2: Add DecimalQuantityString brand type, decimalQuantitySchema, decimalQuantityNonZeroSchema in server/db/schema/utils.ts. Update brandedDecimalQuantity to use DecimalQuantityString. Add isDecimalQuantityString and createDecimalQuantityString in shared/schema/utils.ts."
    status: cancelled
  - id: transaction-schema
    content: "Task 3: Update securityTransactionOrphanInsertSchema.value and securityTransactionSelectSchema.value to use decimalQuantityNonZeroSchema/decimalQuantitySchema in shared/schema/transaction.ts"
    status: cancelled
  - id: sql-casts
    content: "Task 4: Update all 5 decimal(18,2) casts in query.ts and all 9 in database.ts to decimal(18,8) or decimal(18,4) as appropriate"
    status: completed
  - id: type-check
    content: "Task 5: Run npm run check to confirm no type regressions"
    status: completed
isProject: false
---

# Decimal Precision Fix Plan

## Task 1 — DB level only ✓ DONE

### [`server/db/schema/utils.ts`](server/db/schema/utils.ts)

- `brandedDecimal`: scale updated from 2 → 4 (monetary values)
- `brandedDecimalQuantity`: added at scale 8 (share quantities), typed as `DecimalValueString`
- Both helpers documented with precision/scale rationale referencing industry standards

### [`server/db/schema/portfolio-assets.ts`](server/db/schema/portfolio-assets.ts)

- `securityTransactions.value` switched to `brandedDecimalQuantity`

### Migration applied

`0011_decimal-extend-scale` — `ALTER COLUMN` for all affected tables. Safe widening, no data loss.

> **Note on brand types (Tasks 2 & 3 cancelled):** A separate `DecimalQuantityString` brand is not needed. The `DecimalValueString` brand only enforces "validated decimal string format" — it encodes no semantic meaning about decimal places or domain (monetary vs quantity). Both helpers correctly use `DecimalValueString`.

---

## Task 2 — SQL cast updates

### [`server/services/assets/query.ts`](server/services/assets/query.ts) — 5 casts

| Line | Field | New cast |
|---|---|---|
| 61 | `calculatedAssetCurrentValueSql` (monetary) | `decimal(18, 4)` |
| 115 | `accumalitiveSecurityValue` (share running total) | `decimal(18, 8)` |
| 119 | `accumulativeSecurityCurrencyValue` | `decimal(18, 4)` |
| 127 | `accumulativeAssetCurrencyValue` (security CTE) | `decimal(18, 4)` |
| 164 | `accumulativeAssetCurrencyValue` (asset CTE) | `decimal(18, 4)` |

### [`server/services/assets/database.ts`](server/services/assets/database.ts) — 9 locations

| Lines | Field | New cast |
|---|---|---|
| 1267 | `currentValue` (share accumulator) | `decimal(18, 8)` |
| 1268 | `currentCurrencyValue` | `decimal(18, 4)` |
| 1278 | `currentValue` nested object | `decimal(18, 8)` |
| 1279 | `accumulativeCurrencyValue` nested object | `decimal(18, 4)` |
| 1653 | `accumalitiveSecurityValue` | `decimal(18, 8)` |
| 1657 | `accumulativeSecurityCurrencyValue` | `decimal(18, 4)` |
| 1665 | `accumulativeAssetCurrencyValue` | `decimal(18, 4)` |
| 2780 | temp table DDL `value decimal(18,2)` | `decimal(18, 4)` |

---

## Task 3 — Type check

Run `npm run check` to confirm no type regressions across the codebase.

---

---

## Task 4 — Share quantity input precision enforcement

### [`server/db/schema/utils.ts`](server/db/schema/utils.ts)

Add a reusable refinement helper that restricts a decimal string to a maximum number of decimal places:

```ts
export const withMaxDecimalPlaces = (
  schema: z.ZodEffects<z.ZodString, DecimalValueString, string> | typeof decimalValueSchema,
  maxPlaces: number
) =>
  schema.refine(
    (value) => {
      const parts = value.split(".");
      return parts.length === 1 || parts[1].length <= maxPlaces;
    },
    { message: `Value must not exceed ${maxPlaces} decimal places` }
  );
```

### [`shared/schema/transaction.ts`](shared/schema/transaction.ts)

Apply the 8dp limit to `securityTransactionOrphanInsertSchema.value`:

```ts
value: withMaxDecimalPlaces(decimalValueNonZeroSchema, 8),
```

### [`shared/schema/portfolio-assets.ts`](shared/schema/portfolio-assets.ts)

Apply the 8dp limit to `userAssetSecurityInitialHoldingSchema.shareHolding`:

```ts
shareHolding: withMaxDecimalPlaces(decimalValueSchemaRequiredGreaterThanZero, 8),
```

### Client inputs

Add `step="0.00000001"` to the share quantity `<Input>` in both:

- [`client/src/components/account/AssetSecurityTransactionSingleForm.tsx`](client/src/components/account/AssetSecurityTransactionSingleForm.tsx) — `value` field ("Number of Shares")
- [`client/src/components/account/AssetSecurityForm.tsx`](client/src/components/account/AssetSecurityForm.tsx) — `initialHolding.shareHolding` field ("Shares Held")

---

## What does NOT change

- All projection/display `toFixed(2)` calls — intentional presentation rounding, not storage
- `decimalValueSchema`, `decimalValueNonZeroSchema`, `DecimalValueString` — unchanged, used for all decimal fields
