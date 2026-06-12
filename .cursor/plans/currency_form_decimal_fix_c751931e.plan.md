---
name: Currency Form Decimal Fix
overview: ""
todos:
  - id: fix-schema
    content: Update maxDecimalPlaces in shared/schema/decimal-value.ts to strip trailing zeros before counting decimal places
    status: completed
  - id: add-decimal-input
    content: Create client/src/components/ui/decimal-input.tsx — forwardRef component using NumericFormat directly with customInput={Input}, configurable decimalScale
    status: completed
  - id: fix-security-tx-form
    content: Replace <Input> with <DecimalInput decimalScale={2}> for currencyValue field in AssetSecurityTransactionSingleForm
    status: completed
  - id: type-check
    content: Run npm run check to confirm no type errors
    status: completed
  - id: fix-decimal-input-onChange-type
    content: "Update DecimalInput — change onChange type to (value: DecimalValueString) => void and cast value inside onValueChange, removing the intermediate-state throw concern from all consumers"
    status: completed
  - id: fix-security-tx-form-handlers
    content: Simplify AssetSecurityTransactionSingleForm onChange handlers — remove createDecimalValueString calls (DecimalInput now provides DecimalValueString), guard setValue("currencyValue") with isDecimalValueString
    status: completed
  - id: fix-transaction-single
    content: Replace <Input> with <DecimalInput decimalScale={2}> for value field in TransactionSingleForm
    status: completed
  - id: fix-recurring-fields
    content: Replace <Input> with <DecimalInput decimalScale={2}> for amount field in RecurringContributionFields (covers both TransactionRecurringForm and RecurringContributionSecurityDialog)
    status: completed
  - id: fix-numeric-input-forwardref
    content: Update NumericInput to use React.forwardRef for consistency with Input and DecimalInput
    status: completed
isProject: false
---

# Currency Form Decimal Precision Fix

## Problem

The DB column `brandedDecimal` is `DECIMAL(18, 4)` and Postgres always returns 4 decimal places (e.g. `"100.00"` stored → `"100.0000"` retrieved). The shared currency schemas enforce a hard 2dp cap via `maxDecimalPlaces(2)` in [`shared/schema/decimal-value.ts`](shared/schema/decimal-value.ts):

```typescript
export const maxDecimalPlaces = (maxPlaces: number) => (value: string | undefined) => {
  if (!value) return true;
  const parts = value.split(".");
  return parts.length === 1 || (parts[1]?.length ?? 0) <= maxPlaces;
};
```

`maxDecimalPlaces` counts raw string characters, so `"100.0000"` is treated as 4dp and fails validation even though the trailing zeros are semantically meaningless.

## Two-Layer Fix Strategy

### Layer A — Schema fix (`shared/schema/decimal-value.ts`)

Update `maxDecimalPlaces` to strip trailing zeros before counting. One change fixes validation for all current and future uses of the currency schemas, including the FIRE settings fields which use `NumericInput` (already handles display normalization via `react-number-format`).

```typescript
export const maxDecimalPlaces = (maxPlaces: number) => (value: string | undefined) => {
  if (!value) return true;
  const parts = value.split(".");
  if (parts.length === 1) return true;
  const significantPart = (parts[1] ?? "").replace(/0+$/, "");
  return significantPart.length <= maxPlaces;
};
```

Examples: `"100.0000"` → 0 significant dp → passes. `"100.5600"` → 2 significant dp → passes. `"100.1234"` → 4 significant dp → fails.

### Layer B — DecimalInput component (`client/src/components/ui/decimal-input.tsx`)

Uses `NumericFormat` from `react-number-format` (already a project dependency) directly with `customInput={Input}`, wrapped in `React.forwardRef`. This correctly threads the ref through to the underlying `<input>` element for react-hook-form focus-on-error behaviour. Does not wrap `NumericInput` as that component lacks `forwardRef` support.

```typescript
type DecimalInputProps = {
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  decimalScale: number;      // required — 2 = currency, 4 = share value, 8 = share quantity
  allowNegative?: boolean;
};

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ onChange, allowNegative = false, ...props }, ref) => (
    <NumericFormat
      customInput={Input}
      getInputRef={ref}
      onValueChange={({ value }) => onChange(value)}
      allowNegative={allowNegative}
      fixedDecimalScale={false}   // strips trailing zeros from display
      thousandSeparator={false}   // raw decimal fields — no formatting
      {...props}
    />
  )
);
```

**Display normalization** is handled by `NumericFormat` natively:
- `decimalScale={2}` + `fixedDecimalScale={false}` truncates to N dp and strips trailing zeros
- `"1.0000"` → `"1"`, `"1.2345"` → `"1.23"`, `"100.50"` → `"100.5"`

**Input restriction** is also handled by `NumericFormat` — keystrokes beyond `decimalScale` are rejected automatically.

Sits alongside the existing `NumericInput` in `client/src/components/ui/`.

| Usage | decimalScale |
|---|---|
| Currency amounts (`currencyValue`, `value`, `amount`) | 2 |
| Price per share (`perUnitValue`) | 4 |
| Share quantities (`value` on security tx) | 8 |

## Where Each Layer Applies

```
                           Schema fix (A)   DecimalInput (B)   decimalScale
                           ─────────────    ────────────────   ────────────
annualIncomeGoal            ✓               NumericInput already normalizes display
safeWithdrawalRate          ✓               NumericInput already normalizes display
currencyValue (sec. tx.)    ✓               ✓                  2
value (cash tx.)            ✓               ✓                  2
amount (recurring)          ✓               ✓                  2 (via RecurringContributionFields)
```

## RecurringContributionFields Coverage

[`RecurringContributionFields.tsx`](client/src/components/account/RecurringContributionFields.tsx) is the shared component used by both `TransactionRecurringForm` and `RecurringContributionSecurityDialog`. Replacing the `amount` `<Input>` with `<DecimalInput decimalScale={2}>` in this one file covers both forms.

## Not Affected (no change needed)
- `EditMilestoneDialog` — inline schema with no dp restriction
- `AssetValueUpsertDialog` — inline schema with no dp restriction
- `AccountCreate` / `AssetSecurityForm` — create-only for currency fields
- `perUnitValue` — validated by `shareValueNoneZeroSchema` (4dp max, matches DB)
- `value` (share quantity) — validated by `shareQuantityNoneZeroSchema` (8dp max, matches DB)

## DecimalInput onChange type

`DecimalInputProps.onChange` is typed as `(value: DecimalValueString) => void`. Inside the component, `value` from `NumericFormat`'s `onValueChange` is cast to `DecimalValueString` — safe because Zod validates on submit, not on every keystroke. Intermediate states like `"100."` are passed through as a cast and never throw.

Consumers receive a `DecimalValueString` directly and pass it straight to `field.onChange`. No utility import, no branching needed in form handlers. The only remaining consumer concern is guarding derived value computations (e.g. `setValue("currencyValue", ...)`) with `isDecimalValueString` before calling `createDecimalValueString`.

## Files Changed
- [`shared/schema/decimal-value.ts`](shared/schema/decimal-value.ts) — update `maxDecimalPlaces`, add `toDecimalFieldValue`
- [`client/src/components/ui/decimal-input.tsx`](client/src/components/ui/decimal-input.tsx) — new component (forwardRef, NumericFormat, configurable decimalScale)
- [`client/src/components/account/AssetSecurityTransactionSingleForm.tsx`](client/src/components/account/AssetSecurityTransactionSingleForm.tsx) — `DecimalInput` for shares and price fields, `toDecimalFieldValue` in handlers
- [`client/src/components/account/TransactionSingleForm.tsx`](client/src/components/account/TransactionSingleForm.tsx) — `value` field *(post-review)*
- [`client/src/components/account/RecurringContributionFields.tsx`](client/src/components/account/RecurringContributionFields.tsx) — `amount` field *(post-review)*
- [`client/src/components/ui/numeric-input.tsx`](client/src/components/ui/numeric-input.tsx) — add `React.forwardRef` for consistency *(post-review)*
