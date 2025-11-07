# Projection Growth Rate Strategy Implementation

**Status:** Design Document  
**Last Updated:** 2025-01-XX  
**Related Documents:** 
- [projections-plan.md](./projections-plan.md)
- [state-pension-analysis.md](./state-pension-analysis.md)
- [workplace-pension-roadmap.md](./workplace-pension-roadmap.md)

---

## Executive Summary

This document describes the implementation of a flexible growth rate strategy system that allows projections to use either a global growth rate for all contributors or contributor-specific growth rates. This enables support for contributors that don't grow (like state pensions) while maintaining backward compatibility with existing asset-based projections.

**Key Features:**
- Global growth rate mode (default, backward compatible)
- Contributor-specific growth rate mode
- Opt-out mechanism for contributors that shouldn't grow
- Clear semantics: `undefined` or `0` = no growth in both modes

---

## 1. Problem Statement

### 1.1 Current Limitation

The current projection system applies a single global growth rate (`config.growthRate`) to all contributors. This works for assets (ISAs, SIPPs, etc.) but doesn't support:

- **State Pension**: Income payments that don't grow (no pot, no investment growth)
- **Cash Accounts**: No growth expected
- **Mixed Scenarios**: Some contributors growing at different rates

### 1.2 Requirements

1. Support contributors with no growth (state pension, cash)
2. Support per-contributor growth rate overrides
3. Maintain backward compatibility with existing projections
4. Clear, unambiguous semantics for growth rate configuration

---

## 2. Solution Design

### 2.1 Two-Mode System

**Mode 1: Global Growth Rate (Default)**
- All contributors use `config.growthRate`
- Contributors can opt-out by setting `expectedGrowthRate: undefined` or `0`
- Any other value on contributor is ignored

**Mode 2: Contributor-Specific Growth Rates**
- Each contributor uses its own `expectedGrowthRate`
- `undefined` = `0` (no growth)
- Each contributor can have a different growth rate

### 2.2 Key Design Decisions

1. **Global Flag**: `useContributorSpecificGrowthRates: boolean` in projection config
2. **Contributor Field**: `expectedGrowthRate?: number` on contributor
3. **Opt-Out Semantics**: `undefined` or `0` = no growth in both modes
4. **Backward Compatibility**: Default mode is global (existing behavior)

---

## 3. Schema Changes

### 3.1 Projection Config Schema

**File:** `shared/schema/projections.ts`

```typescript
export const baseProjectionConfigSchema = z.object({
  growthModel: growthModelSchema,
  interval: projectionIntervalSchema.default("monthly"),
  modifiers: z.array(projectionModifierSchema).default([]),
  useContributorSpecificGrowthRates: z.boolean().default(false), // NEW
});
```

**Default:** `false` (global mode) for backward compatibility

### 3.2 Contributor Schema

**File:** `shared/schema/projections.ts`

```typescript
export const contributorSchema = z.object({
  referenceId: z.string().uuid().optional(),
  accountType: z.enum(accountType),
  name: z.string(),
  type: z.enum(contributionTypes),
  expectedGrowthRate: z.number().min(-100).max(1000).optional(), // NEW
  valueReleases: z.array(valueReleasePointInTimeSchema).optional(),
  bonusValues: z.array(bonusValueSchema).optional(),
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  schedules: z.array(contributorScheduleSchema),
  taxes: z.array(taxSchema).optional(),
});
```

**Field:** `expectedGrowthRate?: number`
- Optional field
- Range: -100 to 1000 (percentage)
- `undefined` = not set / use default behavior
- `0` = explicit no growth

---

## 4. Calculation Logic

### 4.1 Growth Rate Resolution Function

**File:** `shared/utils/projection-utils.ts` (new function)

```typescript
/**
 * Get effective growth rate for a contributor based on projection config
 * 
 * @param contributor - The contributor to get growth rate for
 * @param config - The projection configuration
 * @returns The effective growth rate to use (as percentage, e.g., 7 for 7%)
 */
export function getEffectiveGrowthRate(
  contributor: Contributor,
  config: SimpleProjectionConfigWithDateRange
): number {
  if (config.useContributorSpecificGrowthRates) {
    // Contributor mode: use contributor's own rate
    // undefined = 0 (no growth)
    return contributor.expectedGrowthRate ?? 0;
  }
  
  // Non-contributor mode: use global rate
  // BUT: undefined or 0 on contributor = opt-out flag (no growth)
  if (contributor.expectedGrowthRate === undefined || 
      contributor.expectedGrowthRate === 0) {
    return 0; // Excluded from growth
  }
  
  // Contributor has a non-zero rate set
  // In non-contributor mode, IGNORE it and use global
  return config.growthRate;
}
```

### 4.2 Integration Points

**Files to Update:**

1. **`shared/utils/projection-simple.ts`**
   - `generateLinearProjectionTimeSeries()` - Use `getEffectiveGrowthRate()`
   - `generateCompoundProjectionTimeSeries()` - Use `getEffectiveGrowthRate()`

2. **`shared/utils/projection-advanced.ts`** (future)
   - Advanced mode calculations

---

## 5. Behavior by Mode

### 5.1 Global Mode (`useContributorSpecificGrowthRates = false`)

**Default behavior for backward compatibility**

**Logic:**
- All contributors use `config.growthRate`
- Exception: If `contributor.expectedGrowthRate` is `undefined` or `0`, that contributor gets `0%` growth
- Any other value on `contributor.expectedGrowthRate` is ignored

**Example:**
```typescript
config: {
  useContributorSpecificGrowthRates: false,
  growthRate: 7
}

contributors: [
  { expectedGrowthRate: undefined }, // → 0% (opt-out)
  { expectedGrowthRate: 0 },        // → 0% (opt-out)
  { expectedGrowthRate: 5 },         // → 7% (5 ignored, uses global)
  { expectedGrowthRate: 10 },       // → 7% (10 ignored, uses global)
  // No expectedGrowthRate field    // → 7% (uses global)
]
```

**Use Cases:**
- Standard portfolio projections (all assets grow at same rate)
- State pension opt-out (set `expectedGrowthRate: 0`)
- Backward compatibility (existing projections)

### 5.2 Contributor Mode (`useContributorSpecificGrowthRates = true`)

**Per-contributor growth rates**

**Logic:**
- Each contributor uses its own `expectedGrowthRate`
- `undefined` = `0` (no growth)
- Each contributor can have different growth rate

**Example:**
```typescript
config: {
  useContributorSpecificGrowthRates: true
}

contributors: [
  { expectedGrowthRate: undefined }, // → 0% (state pension)
  { expectedGrowthRate: 0 },        // → 0% (cash)
  { expectedGrowthRate: 3 },        // → 3% (conservative asset)
  { expectedGrowthRate: 7 },       // → 7% (moderate asset)
  { expectedGrowthRate: 10 },      // → 10% (aggressive asset)
]
```

**Use Cases:**
- Mixed portfolio with different asset growth expectations
- Conservative vs aggressive allocations
- State pension + assets with different growth rates

---

## 6. Implementation Details

### 6.1 Linear Growth Integration

**File:** `shared/utils/projection-simple.ts`

**Current Code:**
```typescript
// Apply linear growth to initial value only
const growthRate = config.growthRate / 100;
const growthValue = Decimal(currentValue)
  .mul(growthRate)
  .mul(yearsFromStart);
```

**Updated Code:**
```typescript
// Get effective growth rate for this contributor
const effectiveGrowthRate = getEffectiveGrowthRate(contributor, config);
const growthRate = effectiveGrowthRate / 100;
const growthValue = effectiveGrowthRate === 0
  ? Decimal(0) // No growth
  : Decimal(currentValue)
      .mul(growthRate)
      .mul(yearsFromStart);
```

### 6.2 Compound Growth Integration

**File:** `shared/utils/projection-simple.ts`

**Current Code:**
```typescript
// Apply compound growth to accumulated value
const growthFactor = Math.pow(1 + config.growthRate / 100, yearsInInterval);
let projectedValue = Decimal(accumulatedValue).mul(growthFactor);
```

**Updated Code:**
```typescript
// Get effective growth rate for this contributor
const effectiveGrowthRate = getEffectiveGrowthRate(contributor, config);
const growthFactor = effectiveGrowthRate === 0
  ? 1 // No growth
  : Math.pow(1 + effectiveGrowthRate / 100, yearsInInterval);
let projectedValue = Decimal(accumulatedValue).mul(growthFactor);
```

### 6.3 Helper Function Location

**File:** `shared/utils/projection-utils.ts`

Add the `getEffectiveGrowthRate()` function to the utility file alongside other projection helpers.

---

## 7. Use Cases

### 7.1 State Pension (No Growth)

**Scenario:** State pension payments starting at age 66

```typescript
const statePensionContributor: Contributor = {
  type: "state_pension",
  name: "UK State Pension",
  accountType: "GIA", // Placeholder
  currentValue: "0",
  expectedGrowthRate: 0, // Explicit: no growth
  schedules: [{
    patternConfig: { type: "monthly", expression: "..." },
    value: "800", // Monthly payment
    startDate: statePensionAgeDate, // Age 66
    endDate: null
  }]
};

// Works in both modes:
// - Global mode: expectedGrowthRate: 0 → 0% growth
// - Contributor mode: expectedGrowthRate: 0 → 0% growth
```

### 7.2 Mixed Portfolio (Different Growth Rates)

**Scenario:** Portfolio with conservative and aggressive assets

```typescript
const config: SimpleProjectionConfig = {
  mode: "simple",
  useContributorSpecificGrowthRates: true, // Enable contributor mode
  growthRate: 7, // Fallback (not used in this mode)
  growthModel: "compound",
  interval: "monthly",
  modifiers: []
};

const contributors: Contributor[] = [
  {
    type: "asset",
    name: "Conservative Bonds",
    expectedGrowthRate: 3, // 3% growth
    // ...
  },
  {
    type: "asset",
    name: "Stock Portfolio",
    expectedGrowthRate: 10, // 10% growth
    // ...
  },
  {
    type: "state_pension",
    name: "State Pension",
    expectedGrowthRate: 0, // No growth
    // ...
  }
];
```

### 7.3 Standard Portfolio (Global Rate)

**Scenario:** All assets grow at same rate (backward compatible)

```typescript
const config: SimpleProjectionConfig = {
  mode: "simple",
  useContributorSpecificGrowthRates: false, // Global mode (default)
  growthRate: 7, // All contributors use this
  growthModel: "compound",
  interval: "monthly",
  modifiers: []
};

const contributors: Contributor[] = [
  {
    type: "asset",
    name: "ISA",
    // No expectedGrowthRate → uses global 7%
    // ...
  },
  {
    type: "asset",
    name: "SIPP",
    // No expectedGrowthRate → uses global 7%
    // ...
  },
  {
    type: "state_pension",
    name: "State Pension",
    expectedGrowthRate: 0, // Opt-out: no growth
    // ...
  }
];
```

---

## 8. Migration Strategy

### 8.1 Backward Compatibility

**Default Behavior:**
- `useContributorSpecificGrowthRates` defaults to `false`
- Existing projections continue to work unchanged
- All contributors use `config.growthRate` as before

**No Breaking Changes:**
- Field is optional on contributor (`expectedGrowthRate?: number`)
- Default config value maintains existing behavior
- Existing code paths unchanged

### 8.2 Migration Path

**Phase 1: Add Fields (Non-Breaking)**
1. Add `useContributorSpecificGrowthRates` to `baseProjectionConfigSchema` (default: `false`)
2. Add `expectedGrowthRate` to `contributorSchema` (optional)
3. Add `getEffectiveGrowthRate()` helper function
4. Update calculation functions to use helper

**Phase 2: Opt-Out Support**
1. State pension contributors set `expectedGrowthRate: 0`
2. Works in global mode (opt-out)
3. No other changes needed

**Phase 3: Contributor Mode (Optional)**
1. Users can enable `useContributorSpecificGrowthRates: true`
2. Set per-contributor growth rates
3. Advanced feature for power users

---

## 9. Testing Requirements

### 9.1 Unit Tests

**File:** `shared/utils/projection-utils.test.ts`

- [ ] `getEffectiveGrowthRate()` - Global mode, opt-out
- [ ] `getEffectiveGrowthRate()` - Global mode, ignored values
- [ ] `getEffectiveGrowthRate()` - Contributor mode, undefined = 0
- [ ] `getEffectiveGrowthRate()` - Contributor mode, explicit rates
- [ ] Edge cases: negative rates, very high rates

### 9.2 Integration Tests

**File:** `shared/utils/projection-simple.test.ts`

- [ ] Linear growth with global mode
- [ ] Linear growth with contributor mode
- [ ] Compound growth with global mode
- [ ] Compound growth with contributor mode
- [ ] State pension (0% growth) in both modes
- [ ] Mixed contributors (some 0%, some with growth)

### 9.3 Edge Cases

- [ ] `expectedGrowthRate: undefined` in global mode (opt-out)
- [ ] `expectedGrowthRate: 0` in global mode (opt-out)
- [ ] `expectedGrowthRate: undefined` in contributor mode (= 0)
- [ ] `expectedGrowthRate: 0` in contributor mode (= 0)
- [ ] `expectedGrowthRate: 5` in global mode (ignored, uses global)
- [ ] Multiple contributors with different rates in contributor mode

---

## 10. API Impact

### 10.1 Request Schema

**No Breaking Changes:**
- `useContributorSpecificGrowthRates` is optional (defaults to `false`)
- `expectedGrowthRate` is optional on contributors

**Example Request:**
```typescript
{
  config: {
    mode: "simple",
    growthRate: 7,
    useContributorSpecificGrowthRates: false, // Optional, defaults to false
    // ...
  },
  contributors: [
    {
      type: "state_pension",
      expectedGrowthRate: 0, // Optional, opt-out in global mode
      // ...
    }
  ]
}
```

### 10.2 Response Schema

**No Changes:**
- Response structure unchanged
- `ProjectionTimePoint` values calculated with effective growth rate
- No new fields in response

---

## 11. Documentation Updates

### 11.1 Code Documentation

- [ ] JSDoc comments for `getEffectiveGrowthRate()`
- [ ] Inline comments explaining mode behavior
- [ ] Examples in code comments

### 11.2 User Documentation

- [ ] Update projection documentation with growth rate strategy
- [ ] Add examples for state pension configuration
- [ ] Document when to use contributor mode vs global mode

### 11.3 API Documentation

- [ ] Document `useContributorSpecificGrowthRates` field
- [ ] Document `expectedGrowthRate` field on contributors
- [ ] Provide request/response examples

---

## 12. Summary

### 12.1 Key Features

✅ **Two-Mode System**
- Global mode (default, backward compatible)
- Contributor mode (per-contributor rates)

✅ **Opt-Out Mechanism**
- `undefined` or `0` = no growth in both modes
- Allows state pension, cash, etc. to opt-out

✅ **Clear Semantics**
- No ambiguity about `undefined` behavior
- Explicit opt-out vs ignored values

✅ **Backward Compatible**
- Default mode maintains existing behavior
- Optional fields, no breaking changes

### 12.2 Implementation Checklist

- [ ] Add `useContributorSpecificGrowthRates` to `baseProjectionConfigSchema`
- [ ] Add `expectedGrowthRate` to `contributorSchema`
- [ ] Implement `getEffectiveGrowthRate()` helper function
- [ ] Update `generateLinearProjectionTimeSeries()` to use helper
- [ ] Update `generateCompoundProjectionTimeSeries()` to use helper
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update documentation
- [ ] Test with state pension contributors

---

**Document Owner:** Development Team  
**Reviewers:** Product, QA  
**Next Review Date:** After implementation

