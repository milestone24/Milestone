# UK State Pension Support Analysis

**Status:** Analysis  
**Last Updated:** 2025-01-XX  
**Related Documents:** 
- [UK-Investments.md](./UK-Investments.md)
- [workplace-pension-roadmap.md](./workplace-pension-roadmap.md)
- [projections-plan.md](./projections-plan.md)

---

## Executive Summary

This document analyzes whether the current projection calculation functions support UK State Pension as a contributor. **Key Finding:** The current system is designed for assets with pots that grow and receive contributions, but state pensions are **income payments** that start at a specific age and don't accumulate in a pot. **Special handling is required.**

---

## 1. UK State Pension Characteristics

### 1.1 What is UK State Pension?

- **Government pension** paid to UK residents who have made sufficient National Insurance contributions
- **Weekly/monthly income payment** (not a pot that accumulates)
- **Starts at State Pension Age** (currently 66, rising to 67)
- **Fixed amount** per week/month (may increase with inflation/triple lock)
- **Taxable as income** (but may be tax-free if total income below personal allowance)
- **No growth** (it's income, not an investment)
- **No contributions** (based on past NI contributions, not ongoing payments)

### 1.2 Key Differences from Assets

| Aspect | Assets (ISA, SIPP, etc.) | State Pension |
|--------|-------------------------|---------------|
| **Initial Value** | Has a pot/current value | Zero (no pot) |
| **Growth** | Yes (investments grow) | No (fixed payments) |
| **Contributions** | Ongoing contributions add to pot | No contributions (past NI only) |
| **Value Over Time** | Pot accumulates and grows | Income payments (no accumulation) |
| **Access** | Age/date restrictions on pot | Starts at state pension age |
| **For FIRE** | Part of portfolio value | Reduces required portfolio (income) |

---

## 2. Current System Analysis

### 2.1 What's Already Supported

✅ **Contributor Type**
- `"state_pension"` is defined in `contributionTypes` enum
- Contributor schema supports all required fields

✅ **Scheduled Payments**
- `schedules` array can define recurring payments
- Can specify start date (state pension age)
- Can specify payment frequency (weekly/monthly)

✅ **Value Release System**
- Can restrict payments to start at specific age
- Age-based predicates work

### 2.2 What's Missing or Incorrect

❌ **Growth Application**
- Current functions apply growth rate to `currentValue` and accumulated value
- **Problem:** State pension has no pot to grow
- **Impact:** Incorrectly calculates growth on zero/non-existent pot

❌ **Income vs Contribution Model**
- Current functions treat payments as "contributions" that add to a pot
- **Problem:** State pension payments are income, not contributions
- **Impact:** Incorrectly accumulates payments as if building a pot

❌ **FIRE Calculation Integration**
- State pension should **reduce** required portfolio value (it's income)
- Current system treats it as part of portfolio (adds to pot)
- **Impact:** FIRE calculations don't account for state pension income

❌ **No Growth Model**
- State pension payments don't grow (they're fixed)
- Current system always applies growth rate
- **Impact:** Incorrectly applies investment growth to income payments

❌ **Tax Handling**
- State pension is taxable income
- Current `taxes` field exists but not implemented
- **Impact:** No tax calculation on state pension income

---

## 3. Current Calculation Flow Issues

### 3.1 How Current Functions Work

**For Assets (ISA, SIPP, etc.):**
```
1. Start with currentValue (pot)
2. Apply growth to pot: pot * (1 + growthRate)^years
3. Add contributions: pot + contributions + bonuses
4. Result: Larger pot value
```

**What Happens with State Pension (Incorrectly):**
```
1. Start with currentValue = "0" (no pot)
2. Apply growth to zero: 0 * (1 + growthRate)^years = 0
3. Add "contributions" (payments): 0 + payments
4. Result: Payments accumulate as if building a pot ❌
```

### 3.2 Specific Code Issues

#### Issue 1: Growth Applied to State Pension

```typescript
// projection-simple.ts - generateCompoundProjectionTimeSeries()
// Apply compound growth to accumulated value
const growthFactor = Math.pow(1 + config.growthRate / 100, yearsInInterval);
let projectedValue = Decimal(accumulatedValue).mul(growthFactor);
```

**Problem:** State pension has no `accumulatedValue` to grow. Payments are income, not a growing pot.

#### Issue 2: Payments Treated as Contributions

```typescript
// projection-simple.ts
// Add both user contributions and bonuses to portfolio value
projectedValue = Decimal(projectedValue)
  .add(periodContributions)
  .add(periodBonuses);
accumulatedValue = Decimal(projectedValue);
```

**Problem:** State pension payments should be income, not added to a portfolio pot.

#### Issue 3: No Special Handling for Income Contributors

```typescript
// projection-orchestrator.ts - projectSingleContributor()
// No check for contributor.type === "state_pension"
// Treated same as assets
```

**Problem:** State pension needs different calculation logic.

---

## 4. Required Changes

### 4.1 New Calculation Model for State Pension

**State Pension Should:**
1. **No initial pot** - `currentValue = "0"`
2. **No growth** - Payments are fixed (growthRate = 0% or ignored)
3. **Income payments** - Payments start at state pension age
4. **Cumulative income** - Track total income received (for display)
5. **For FIRE** - Reduce required portfolio by annual state pension income

### 4.2 Implementation Options

#### Option A: Special Case in Projection Functions

Add conditional logic to detect `contributor.type === "state_pension"` and use different calculation:

```typescript
if (contributor.type === "state_pension") {
  // Income model: no growth, no pot accumulation
  // Just track cumulative payments
} else {
  // Asset model: growth + contributions to pot
}
```

**Pros:**
- Minimal changes
- Reuses existing infrastructure
- Clear separation

**Cons:**
- Special cases in code
- May need multiple special cases (workplace pension, etc.)

#### Option B: Income Contributor Type

Create a new category: `incomeContributors` vs `assetContributors`:

```typescript
type IncomeContributor = {
  type: "state_pension" | "annuity" | "rental_income";
  // No currentValue (or always 0)
  // No growth
  // Payments are income, not contributions
}
```

**Pros:**
- Clearer model
- Extensible for other income types
- Better separation of concerns

**Cons:**
- More refactoring
- Need to handle both types in aggregation

#### Option C: Growth Model Flag

Add `growthModel: "income" | "asset"` to contributor:

```typescript
contributor: {
  type: "state_pension",
  growthModel: "income", // No growth, income payments
  // ...
}
```

**Pros:**
- Flexible
- Can handle edge cases
- Clear intent

**Cons:**
- More complex
- Need to update all calculation paths

**Recommendation:** **Option A** for MVP, migrate to **Option B** if more income types are needed.

---

## 5. Required Implementation Changes

### 5.1 Calculation Function Updates

#### 5.1.1 State Pension Detection

```typescript
// projection-simple.ts
function generateSimpleProjection(input: SimpleProjectionInput): SimpleProjectionResult {
  if (input.contributor.type === "state_pension") {
    return generateStatePensionProjection(input);
  }
  // Existing asset projection logic
}
```

#### 5.1.2 State Pension Projection Function

```typescript
function generateStatePensionProjection(
  input: SimpleProjectionInput
): SimpleProjectionResult {
  // No growth applied
  // No pot accumulation
  // Just track cumulative income payments
  // Payments start at state pension age (from schedules)
  
  const timePoints: ProjectionTimePoint[] = [];
  let cumulativeIncome = Decimal(0);
  
  // Generate time points
  // For each point:
  // - Calculate payments received up to that date
  // - No growth
  // - Value = cumulative income (for display)
  // - Accessible value = cumulative income (no restrictions after start age)
  
  return {
    timePoints,
    totalGrowth: "0", // No growth
    totalContributions: cumulativeIncome.toString(),
    finalValue: cumulativeIncome.toString(),
  };
}
```

#### 5.1.3 FIRE Calculation Integration

```typescript
// projection-fire-calculator.ts
// When calculating FIRE number, subtract state pension income:

const statePensionAnnualIncome = calculateStatePensionAnnualIncome(contributors);
const adjustedFireNumber = fireNumber - statePensionAnnualIncome;
```

### 5.2 Value Release Configuration

State pension should have value release at state pension age:

```typescript
function defineStatePensionValueReleases(
  statePensionAge: number
): ValueReleasePointInTime[] {
  return [
    {
      value: statePensionAge.toString(),
      valueType: "age",
      penalties: [
        {
          rule: { comparator: "lt", value: statePensionAge.toString() },
          penalty: { valueType: "percentage", value: "1.0" } // 100% locked before age
        }
      ],
      exceptions: []
    }
  ];
}
```

### 5.3 Tax Handling

State pension is taxable income (but may be tax-free if below personal allowance):

```typescript
// Add tax calculation for state pension income
// Apply at payment level (not withdrawal from pot)
// Consider personal allowance
```

---

## 6. Testing Requirements

### 6.1 Unit Tests

- [ ] State pension projection with zero growth
- [ ] Payments start at correct age
- [ ] No pot accumulation (value = cumulative payments only)
- [ ] Value release restrictions before state pension age
- [ ] Tax calculation on state pension income

### 6.2 Integration Tests

- [ ] State pension + assets in same projection
- [ ] FIRE calculation with state pension
- [ ] Aggregation of state pension with other contributors
- [ ] State pension age boundary (66/67)

### 6.3 Edge Cases

- [ ] State pension age before projection start
- [ ] State pension age after projection end
- [ ] Multiple state pension contributors (different ages)
- [ ] State pension with inflation modifier

---

## 7. FIRE Calculation Impact

### 7.1 Current FIRE Calculation

```typescript
FIRE Number = Annual Income Goal / (Safe Withdrawal Rate / 100)
Required Portfolio = FIRE Number
```

### 7.2 With State Pension

```typescript
FIRE Number = Annual Income Goal / (Safe Withdrawal Rate / 100)
State Pension Annual Income = calculateStatePensionAnnualIncome()
Adjusted FIRE Number = FIRE Number - State Pension Annual Income
Required Portfolio = Adjusted FIRE Number
```

**Example:**
- Annual Income Goal: £30,000
- Safe Withdrawal Rate: 4%
- FIRE Number: £750,000
- State Pension Annual: £10,000
- **Adjusted FIRE Number: £740,000** ✅

---

## 8. Implementation Roadmap

### Phase 1: Basic State Pension Support

- [ ] Add state pension detection in `generateSimpleProjection()`
- [ ] Create `generateStatePensionProjection()` function
- [ ] Implement zero-growth, income-only model
- [ ] Add value release at state pension age
- [ ] Update aggregation to handle income contributors

**Estimated Effort:** 2-3 days

### Phase 2: FIRE Integration

- [ ] Calculate state pension annual income
- [ ] Adjust FIRE number calculation
- [ ] Update FIRE projection display
- [ ] Handle state pension in retirement scenarios

**Estimated Effort:** 1-2 days

### Phase 3: Tax and Advanced Features

- [ ] Implement tax calculation on state pension
- [ ] Handle personal allowance
- [ ] Support inflation adjustments (triple lock)
- [ ] Multiple state pension scenarios

**Estimated Effort:** 2-3 days

---

## 9. Open Questions

1. **Growth Model:** Should state pension payments increase with inflation? (UK triple lock)
2. **Tax Calculation:** Should tax be calculated per payment or annually?
3. **Personal Allowance:** How to handle personal allowance in tax calculations?
4. **Multiple State Pensions:** Can users have multiple state pension contributors?
5. **Display:** How should state pension be displayed in projections? (Income vs pot value)

---

## 10. Summary

### Current State
- ✅ State pension type exists in schema
- ✅ Can define schedules for payments
- ❌ Calculation functions treat it as asset (incorrect)
- ❌ No special handling for income vs pot model
- ❌ FIRE calculations don't account for state pension income

### Required Changes
1. **New calculation function** for state pension (income model, no growth)
2. **FIRE integration** to reduce required portfolio by state pension income
3. **Value release** at state pension age
4. **Tax handling** for state pension income
5. **Aggregation logic** to handle income contributors differently

### Recommendation
Implement **Phase 1** first to get basic state pension support working, then add FIRE integration and tax handling in subsequent phases.

---

**Document Owner:** Development Team  
**Reviewers:** Product, QA  
**Next Review Date:** After Phase 1 implementation


