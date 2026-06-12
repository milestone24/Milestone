# Decimal Schema Field Audit

This document catalogues every decimal-valued field across the shared insert and select schemas,
classifying each by semantic type and recording its current validation state.

Available schemas are defined in `shared/schema/decimal-value.ts`.

---

## Semantic Types

| Type | Precision | Schema (non-zero) | Schema (> 0) |
|---|---|---|---|
| Currency | 2 dp | `currencyNonZeroSchema` | `currencyGreaterThanZeroSchema` |
| Share quantity | 8 dp | `shareQuantityNoneZeroSchema` | `shareQuantityGreaterThanZeroSchema` |

Response / select schemas use `decimalValueSchema` directly — no precision cap is required
because these values come from the database, not user input.

---

## Insert / Form Schemas (user input — precision validation required)

### `shared/schema/transaction.ts`

#### `userAssetTransactionOrphanInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `value` | Currency | non-zero | `currencyNonZeroSchema` | ✅ migrated |
| `currencyValue` | Currency | optional, non-zero | `currencyNonZeroSchema.optional()` | ✅ migrated |
| `fees` | Currency | optional, > 0 | `currencyGreaterThanZeroSchema.optional()` | ✅ migrated |

#### `assetContributionOrphanInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `value` | Currency | non-zero | `z.string().refine(isDecimalValueString)` | ❌ needs migration |
| `currencyValue` | Currency | optional | `decimalValueSchema.refine(maxDecimalPlaces(2))` | ❌ needs migration |
| `fees` | Currency | optional | `decimalValueSchema.refine(maxDecimalPlaces(2))` | ❌ needs migration |

#### `securityTransactionOrphanInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `value` | Share quantity | > 0 | `shareQuantityAboveZeroSchema` | ⚠️ schema name does not exist — intended: `shareQuantityGreaterThanZeroSchema` |
| `currencyValue` | Currency | non-zero | `currencyNonZeroSchema` | ✅ migrated |
| `fees` | Currency | optional, non-zero | `currencyNonZeroSchema.optional()` | ✅ migrated |

#### `recurringContributionOrphanInsertSchemaBase`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `amount` | Currency | > 0 | `currencyRequiredGreaterThanZeroSchema` | ⚠️ schema name does not exist — intended: `currencyGreaterThanZeroSchema` |

#### `recurringContributionSelectSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `amount` | Currency | > 0 | `currencyRequiredGreaterThanZeroSchema` | ⚠️ schema name does not exist — intended: `currencyGreaterThanZeroSchema` |

---

### `shared/schema/portfolio-assets.ts`

#### `userAssetSecurityInitialHoldingSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `shareHolding` | Share quantity | > 0 | `decimalValueSchemaRequiredGreaterThanZero.refine(isDecimalValueString).refine(maxDecimalPlaces(8))` | ❌ needs migration → `shareQuantityGreaterThanZeroSchema` |
| `currencyValue` | Currency | > 0 | `decimalValueSchemaRequiredGreaterThanZero.refine(isDecimalValueString).refine(maxDecimalPlaces(2))` | ❌ needs migration → `currencyGreaterThanZeroSchema` |

#### `userAssetSecurityLinkInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `priorGainLoss` | Currency | optional | `decimalValueSchema.refine(isDecimalValueString).refine(maxDecimalPlaces(2)).optional()` | ❌ needs migration → `currencyNonZeroSchema.optional()` |

#### `userAssetOrphanInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `currentValue` | Currency | optional | `decimalValueSchema.refine(isDecimalValueString).refine(maxDecimalPlaces(2)).optional()` | ❌ needs migration → `currencyGreaterThanZeroSchema.optional()` |
| `initialCashHolding` | Currency | optional, > 0 | `decimalValueSchemaRequiredGreaterThanZero.refine(isDecimalValueString).refine(maxDecimalPlaces(2)).optional()` | ❌ needs migration → `currencyGreaterThanZeroSchema.optional()` |

#### `userAssetValueOrphanInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `value` | Currency (manual entry) | > 0 | `decimalValueSchema.refine(isDecimalValueString)` | ❌ needs migration → `currencyGreaterThanZeroSchema` |

---

### `shared/schema/portfolio-milestone.ts`

#### `milestoneOrphanInsertSchema`

| Field | Semantic type | Required | Current schema | Status |
|---|---|---|---|---|
| `targetValue` | Currency | > 0 | `decimalValueSchema.refine(isDecimalValueString).refine(maxDecimalPlaces(2))` | ❌ needs migration → `currencyGreaterThanZeroSchema` |

---

## Select / Response Schemas (API responses — no precision cap required)

These schemas parse database or API response data. They use `decimalValueSchema` (or
`decimalValueSchema.refine(isDecimalValueString)`) and are correct as-is.

| Schema | Fields |
|---|---|
| `transactionAbstractSchema` | `value`, `currencyValue`, `accumulativeAssetCurrencyValue` |
| `flatCombinedTransactionRowSchema` | `fees` |
| `assetTransactionSelectSchema` | `value`, `currencyValue`, `fees` |
| `securityTransactionSelectSchema` | `value`, `currencyValue`, `fees` |
| `calculatedValueSchema` | `value`, `currentChange`, `currentChangePercentage` |
| `resolvedAssetSecuritySchema` | `priorGainLoss` |
| `resolvedUserAssetSchema` | `currentValue` |
| `userAssetWithValueSchema` | `currentValue` |
| `assetValueMetadataSecuritySchema` | `value`, `shareHolding` |
| `assetValueHistorySchema` | `value` |
| `assetsChangeSchema` | `startValue` |
| `portfolioValueSchema` | `value`, `returnValue` |
| `portfolioRangeReturnsSchema` | `beginningValue`, `endingValue`, `modifiedDietz`, `timeWeightedReturn` |
| `combinedDayValuesChangeSchema` | `previousValue`, `newValue`, `change` |
| `milestoneSchema` | `targetValue` |

---

## Outstanding Issues

1. **`shareQuantityAboveZeroSchema`** — referenced in `securityTransactionOrphanInsertSchema.value` but not defined in `decimal-value.ts`. Rename to `shareQuantityGreaterThanZeroSchema` or add an alias.
2. **`currencyRequiredGreaterThanZeroSchema`** — referenced in `recurringContributionOrphanInsertSchemaBase.amount` and `recurringContributionSelectSchema.amount` but not defined. Rename usages to `currencyGreaterThanZeroSchema` or add an alias.
3. **`console.log`** — debug log present in `decimalValueNonZeroSchema` in `decimal-value.ts` (line 66). Should be removed before commit.
