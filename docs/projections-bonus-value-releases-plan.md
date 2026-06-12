# Value Releases and Bonus Values Implementation Plan

## Overview

Integrate bonus values and value release rules into the projection system to accurately model UK investment account behaviors (LISA, SIPP, ISAs, etc.). This will enable projections to account for government bonuses on contributions and restrictions on when funds can be accessed without penalties.

## Implementation Status

- ✅ **Phase 1: Schema Enhancements** - COMPLETED
- ✅ **Phase 2: Bonus Value Application Logic** - COMPLETED
- ✅ **Phase 3: Value Release & Penalty Logic** - COMPLETED
- ✅ **Phase 4: Integration into Projection Time Series** - COMPLETED
- ✅ **Phase 5: Update Orchestrator & Context** - COMPLETED
- ✅ **Phase 6: Date of Birth Context** - COMPLETED
- ✅ **Phase 7: FIRE Chart Value Release Display** - COMPLETED
- ✅ **Phase 8: ProjectionResult Enhancements** - COMPLETED
- ⏳ **Phase 9: Testing** - PENDING
- ⏳ **Phase 10: Documentation & Examples** - PENDING
- ✅ **Phase 11: Client-Side Considerations** - COMPLETED (minimal contributor support added)

## Current State

### Existing Schema
- ✅ `bonusValueSchema` - Enhanced in `shared/schema/projections.ts` (lines 317-332)
- ✅ `valueReleasePointInTimeSchema` - Enhanced in `shared/schema/projections.ts` (lines 344-364)
- ✅ `projectionTimePointSchema` - Enhanced in `shared/schema/projections.ts` (lines 241-263)
- ✅ `ProjectionOrchestratorInput` - Enhanced in `shared/schema/projections.ts` (line 635)
- ✅ `contributorSchema` - Contains `valueReleases` and `bonusValues` arrays (lines 401-407)
- ✅ Test file updated to match new schema structure

### Implementation Status
- ✅ Bonus values are applied to contributions during projection
- ✅ Value release rules are checked at projection time points
- ✅ Penalties for early withdrawal are calculated
- ✅ Annual limits tracking logic implemented
- ✅ Accessible value displayed in FIRE chart with toggle
- ✅ Total bonuses tracked in ProjectionResult
- ✅ User contributions separated from bonuses in tracking
- ⏳ Comprehensive tests needed for all scenarios
- ⏳ Documentation examples needed

## Phase 1: Schema Enhancements & Validation ✅ COMPLETED

**Status:** ✅ Completed on [Date]

### 1.1 Enhance Bonus Value Schema ✅
**File:** `shared/schema/projections.ts` (lines 317-332)

**Completed enhancements:**
- ✅ Added optional `annualLimit` field (DecimalValueString) for tracking maximum bonus per tax year
- ✅ Added optional `annualContributionLimit` field (DecimalValueString) for tracking maximum contributions eligible for bonus per tax year
- ✅ Added optional `priority` field (number) for ordering when multiple bonuses apply

**Implementation details:**
```typescript
export const bonusValueSchema = z.object({
  name: z.string(),
  valueType: z.enum(["percentage", "fixed"]),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  annualLimit: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual limit must be a valid decimal string",
  }).optional(), // Maximum bonus amount per tax year (e.g., £1,000 for LISA)
  annualContributionLimit: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual contribution limit must be a valid decimal string",
  }).optional(), // Maximum contributions eligible for bonus per tax year (e.g., £4,000 for LISA)
  priority: z.number().int().min(0).optional(), // Lower number = higher priority when multiple bonuses apply
});
```

### 1.2 Enhance Value Release Schema ✅
**File:** `shared/schema/projections.ts` (lines 344-364)

**Completed enhancements:**
- ✅ Restructured penalty to include `penalty` object with `valueType` (percentage/fixed) and `value`
- ✅ Added optional `exceptions` array for special cases (e.g., "first_home", "terminal_illness")
- ✅ Added comments clarifying `value` field format (age as string or ISO date string)

**Implementation details:**
```typescript
export const valueReleasePointInTimeSchema = z.object({
  valueType: z.enum(["age", "date"]),
  value: z.string(), // Age as string (e.g., "60") or ISO date string (e.g., "2025-04-06")
  penalties: z
    .array(
      z.object({
        rule: z.object({
          comparator: z.enum(["lt", "lte", "gt", "gte", "eq", "neq"]),
          value: z.string(), // Age or date string to compare against
        }),
        penalty: z.object({
          valueType: z.enum(["percentage", "fixed"]), // Percentage (e.g., "0.25" = 25%) or fixed amount
          value: decimalValueSchema.refine(isDecimalValueString, {
            message: "Penalty value must be a valid decimal string",
          }),
        }),
      })
    )
    .optional(),
  exceptions: z.array(z.string()).optional(), // Special cases that qualify (e.g., ["first_home", "terminal_illness"] for LISA)
});
```

### 1.3 Enhance Projection Time Point Schema ✅
**File:** `shared/schema/projections.ts` (lines 241-263)

**Completed enhancements:**
- ✅ Added optional `bonuses` field (DecimalValueString) for tracking total bonuses applied by this date
- ✅ Added optional `accessibleValue` field (DecimalValueString) for value accessible without penalty
- ✅ Added optional `lockedValue` field (DecimalValueString) for value locked until release point(s)

**Implementation details:**
```typescript
export const projectionTimePointSchema = z.object({
  date: z.coerce.date(),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  contributions: decimalValueSchema.refine(isDecimalValueString, {
    message: "Contributions must be a valid decimal string",
  }),
  growth: decimalValueSchema.refine(isDecimalValueString, {
    message: "Growth must be a valid decimal string",
  }),
  bonuses: decimalValueSchema.refine(isDecimalValueString, {
    message: "Bonuses must be a valid decimal string",
  }).optional(), // Total bonuses applied by this date
  accessibleValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Accessible value must be a valid decimal string",
  }).optional(), // Value accessible without penalty at this date
  lockedValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Locked value must be a valid decimal string",
  }).optional(), // Value locked until release point(s)
  appliedModifiers: z.record(z.number()).optional(),
  projectedValue: z.boolean().default(true),
});
```

### 1.4 Enhance Projection Orchestrator Input ✅
**File:** `shared/schema/projections.ts` (line 635)

**Completed enhancements:**
- ✅ Added optional `dateOfBirth?: Date` field for age-based value release calculations

**Implementation details:**
```typescript
export type ProjectionOrchestratorInput = {
  contributors: Contributor[];
  config: ProjectionConfigWithDateRange;
  dateOfBirth?: Date; // For age-based value release calculations
  milestoneTarget?: MilestoneTarget;
};
```

### 1.5 Update Test File ✅
**File:** `shared/utils/projection-fire-calculator-p.test.ts`

**Completed updates:**
- ✅ Updated penalty structure to use new `penalty` object with `valueType`
- ✅ Added example annual limits for LISA bonus (`annualLimit` and `annualContributionLimit`)
- ✅ Updated penalty value to match LISA 25% penalty (changed from 0.1 to 0.25)

**Changes made:**
- Restructured penalties array to use `penalty: { valueType, value }` format
- Added `annualLimit: "1000"` and `annualContributionLimit: "4000"` to LISA bonus example

---

## Phase 2: Bonus Value Application Logic ✅ COMPLETED

**Status:** ✅ Completed

### 2.1 Create Bonus Value Calculator Service ✅
**New file:** `shared/utils/projection-bonus-calculator.ts`

**Functions implemented:**

#### `calculateBonusForContribution()` ✅
```typescript
function calculateBonusForContribution(
  contribution: DecimalValueString,
  bonus: BonusValue,
  contributionDate: Date,
  annualUsage: BonusAnnualUsage
): {
  bonusAmount: DecimalValueString,
  updatedAnnualUsage: BonusAnnualUsage
}
```
**Implemented:**
- ✅ Apply percentage or fixed bonus to contribution amount
- ✅ Check against annual contribution limit if provided
- ✅ Check against annual bonus limit if provided
- ✅ Track both contribution and bonus usage separately per tax year
- ✅ Handle edge cases: zero contribution, exceeding limits
- ✅ Uses `BonusAnnualUsage` interface to track both usage types

#### `applyBonusValuesToContribution()` ✅
```typescript
function applyBonusValuesToContribution(
  contribution: DecimalValueString,
  bonusValues: BonusValue[],
  contributionDate: Date,
  annualUsage: Map<string, BonusAnnualUsage>
): {
  totalContribution: DecimalValueString,
  totalBonus: DecimalValueString,
  bonusBreakdown: Array<{ bonusName: string, amount: DecimalValueString }>,
  updatedAnnualUsage: Map<string, BonusAnnualUsage>
}
```
**Implemented:**
- ✅ Apply all applicable bonuses to a contribution
- ✅ Sort bonuses by priority (lower number = higher priority)
- ✅ Track annual limits across multiple bonuses
- ✅ Return breakdown for transparency
- ✅ Handle multiple bonuses with individual tracking

#### Tax Year Helpers ✅
- ✅ `getTaxYearStart(date: Date): Date` - Get UK tax year start (April 6)
- ✅ `getTaxYearForDate(date: Date): string` - Get tax year identifier (e.g., "2024-2025")
- ✅ `isTaxYearBoundary(date: Date): boolean` - Check if date is tax year boundary

**Annual Usage Tracking:**
```typescript
interface BonusAnnualUsage {
  contributionUsage: Map<string, DecimalValueString>; // taxYear -> contribution amount
  bonusUsage: Map<string, DecimalValueString>; // taxYear -> bonus amount
}
```

### 2.2 Integrate Bonus Calculation into Contribution Flow ✅
**File:** `shared/utils/projection-utils.ts`

**Updated `calculatePeriodContributions()`:**
- ✅ Changed signature to accept `Contributor` instead of `ContributorSchedule[]`
- ✅ Added `annualBonusUsage?: Map<string, BonusAnnualUsage>` parameter
- ✅ Apply bonus values before modifiers are applied
- ✅ Track annual bonus usage per contributor per tax year
- ✅ Pass bonus usage tracking through projection iterations
- ✅ Returns `{ contributions, bonuses, updatedAnnualUsage }`

**Implementation details:**
- Bonuses are applied to each contribution when it's generated
- Annual usage is tracked per bonus name, per tax year
- Bonus amounts are tracked separately from contributions
- Updated usage is returned for use in subsequent periods

## Phase 3: Value Release & Penalty Logic ✅ COMPLETED

**Status:** ✅ Completed

### 3.1 Create Value Release Checker Service ✅
**New file:** `shared/utils/projection-value-release.ts`

**Functions implemented:**

#### `calculateAgeAtDate()` ✅
```typescript
function calculateAgeAtDate(dateOfBirth: Date, date: Date): number
```
**Implemented:**
- ✅ Calculate age at a specific date from date of birth
- ✅ Uses `date-fns` `differenceInYears` for accurate calculation

#### `checkValueReleaseEligibility()` ✅
```typescript
function checkValueReleaseEligibility(
  releasePoint: ValueReleasePointInTime,
  checkDate: Date,
  dateOfBirth?: Date
): {
  isEligible: boolean,
  releaseValue: string | null
}
```
**Implemented:**
- ✅ Parse `valueType` ("age" or "date")
- ✅ For age-based: Calculate age from DOB and check against release value
- ✅ For date-based: Parse ISO date string and compare with checkDate
- ✅ Return eligibility status and release value

#### `evaluatePenaltyRule()` ✅
```typescript
function evaluatePenaltyRule(
  rule: { comparator: "lt" | "lte" | "gt" | "gte" | "eq" | "neq", value: string },
  checkValue: string | number,
  valueType: "age" | "date"
): boolean
```
**Implemented:**
- ✅ Evaluate comparator rules (lt, lte, gt, gte, eq, neq)
- ✅ Parse rule value (age or date) and compare with context
- ✅ Return true if rule matches (penalty should apply)
- ✅ Handles both age and date comparisons

#### `calculatePenaltyAmount()` ✅
```typescript
function calculatePenaltyAmount(
  value: DecimalValueString,
  penalty: { valueType: "percentage" | "fixed", value: DecimalValueString }
): DecimalValueString
```
**Implemented:**
- ✅ Apply percentage or fixed penalty to value
- ✅ Uses Decimal.js for accurate calculations
- ✅ Handles edge cases (negative values, zero penalties)

#### `findApplicablePenalty()` ✅
```typescript
function findApplicablePenalty(
  releasePoint: ValueReleasePointInTime,
  checkDate: Date,
  dateOfBirth?: Date
): DecimalValueString | null
```
**Implemented:**
- ✅ Find applicable penalty for a value release point if not eligible
- ✅ Evaluates penalty rules to determine if penalty applies
- ✅ Returns penalty value structure if applicable

### 3.2 Calculate Accessible Value at Each Time Point ✅
**New file:** `shared/utils/projection-accessible-value.ts`

**Functions implemented:**

#### `calculateAccessibleValue()` ✅
```typescript
function calculateAccessibleValue(
  contributor: Contributor,
  totalValue: DecimalValueString,
  date: Date,
  dateOfBirth?: Date
): {
  accessibleValue: DecimalValueString,
  lockedValue: DecimalValueString,
  penaltyAmount: DecimalValueString,
  isEligible: boolean
}
```
**Implemented:**
- ✅ Check all value release points for the contributor
- ✅ Determine if any release point is satisfied (uses most favorable/earliest)
- ✅ Calculate accessible vs locked value
- ✅ Apply penalties if accessing early (calculates what would be accessible after penalty)
- ✅ Return detailed breakdown including penalty amount and eligibility status

**Implementation details:**
- Multiple release points: Uses most favorable (earliest accessible) release point
- Penalties: Calculates what user would receive if withdrawing early (total - penalty)
- Locked value: Tracks separately from accessible value
- Handles cases with no value releases (all value accessible)
- Handles cases with no penalties (value locked but no penalty)

#### `getAccessibleValue()` ✅
```typescript
function getAccessibleValue(
  contributor: Contributor,
  totalValue: DecimalValueString,
  date: Date,
  dateOfBirth?: Date
): DecimalValueString
```
**Implemented:**
- ✅ Simplified version returning just accessible value
- ✅ Useful when full breakdown is not needed

## Phase 4: Integration into Projection Time Series ✅ COMPLETED

**Status:** ✅ Completed

### 4.1 Update Simple Projection Input ✅
**File:** `shared/utils/projection-simple.ts`

**Updated `SimpleProjectionInput` interface:**
```typescript
export interface SimpleProjectionInput {
  currentValue: DecimalValueString;
  currentDate?: Date;
  scheduledContributions: ContributorSchedule[];
  contributor: Contributor; // ✅ ADDED: Full contributor with bonuses and value releases
  dateOfBirth?: Date; // ✅ ADDED: For age-based value releases
  config: SimpleProjectionConfigWithDateRange;
  modifierChain?: ModifierChain;
}
```

### 4.2 Update Contribution Calculation in Time Series ✅
**File:** `shared/utils/projection-simple.ts`

**Updated `generateLinearProjectionTimeSeries()`:**
- ✅ Pass `Contributor` to `calculatePeriodContributions()`
- ✅ Apply bonus values when calculating contributions
- ✅ Track annual bonus usage per tax year using `Map<string, BonusAnnualUsage>`
- ✅ Calculate accessible value at each time point (including initial point)
- ✅ Include bonus amounts in time point data
- ✅ Track total bonuses separately from contributions

**Updated `generateCompoundProjectionTimeSeries()`:**
- ✅ Same updates as linear projection
- ✅ Tracks bonuses and calculates accessible value at each time point

**Implementation details:**
1. ✅ Initialize annual bonus usage tracker: `Map<string, BonusAnnualUsage>`
2. ✅ For each contribution in period:
   - Calculate base contribution
   - Apply bonus values (tracking usage per tax year)
   - Add bonus to contribution total
   - Apply modifiers (tax, inflation) after bonuses
3. ✅ At each time point:
   - Calculate accessible value using `calculateAccessibleValue()`
   - Store bonuses, accessibleValue, and lockedValue in time point
   - Include all new fields in `createProjectionTimePoint()` call

### 4.3 Update Projection Time Point Schema ✅
**File:** `shared/schema/projections.ts` (lines 241-263)

**Status:** ✅ Completed in Phase 1

**Decision made:** Added fields to schema for better UX and transparency (Option a)

**Implementation:**
- ✅ Added `bonuses?: DecimalValueString` field
- ✅ Added `accessibleValue?: DecimalValueString` field
- ✅ Added `lockedValue?: DecimalValueString` field
- All fields are optional for backward compatibility

## Phase 5: Update Orchestrator & Context ✅ COMPLETED

**Status:** ✅ Completed

### 5.1 Pass Contributor to Simple Projection ✅
**File:** `shared/utils/projection-orchestrator.ts`

**Updated `projectSingleContributor()`:**
```typescript
async function projectSingleContributor(
  contributor: Contributor,
  config: ProjectionConfigWithDateRange,
  dateOfBirth?: Date // ✅ ADDED: For age-based value releases
): Promise<ContributorProjection>
```
**Implementation:**
- ✅ Pass full `Contributor` object to `generateSimpleProjection()`
- ✅ Pass `dateOfBirth` if available
- ✅ Updated `SimpleProjectionInput` construction to include contributor and DOB

### 5.2 Update Aggregation Function ✅
**File:** `shared/utils/projection-orchestrator.ts`

**Updated `aggregateContributionTimePoints()`:**
- ✅ Aggregates `bonuses` field across all contributors
- ✅ Aggregates `accessibleValue` field across all contributors
- ✅ Aggregates `lockedValue` field across all contributors
- ✅ Handles optional fields (only includes if at least one contributor has them)

### 5.3 Update Orchestrator Function ✅
**File:** `shared/utils/projection-orchestrator.ts`

**Updated `orchestrateProjection()`:**
- ✅ Extracts `dateOfBirth` from `ProjectionOrchestratorInput`
- ✅ Passes `dateOfBirth` to `projectSingleContributor()`
- ✅ Filters contributors by milestone account type if specified

### 5.4 Computation Context ✅
**File:** `shared/schema/projections.ts`

**Status:** `ComputationContext` already includes full contributor data with bonuses and value releases. No changes needed as contributors are already stored in full form.

## Phase 6: Date of Birth Context ✅ COMPLETED

**Status:** ✅ Completed

**Decision:** ✅ Option 2 - Pass as separate parameter for flexibility

**Implementation:**
- ✅ Added `dateOfBirth?: Date` to `ProjectionOrchestratorInput` (Phase 1)
- ✅ Updated `projectSingleContributor()` to accept optional `dateOfBirth`
- ✅ Updated `projectToRetirement()` to pass DOB from `FIREProjectionConfig`
- ✅ Updated `generateSimpleProjection()` to accept and use DOB
- ✅ Updated `SimpleProjectionInput` interface to include `dateOfBirth`

**Files modified:**
- ✅ `shared/utils/projection-orchestrator.ts` - Passes DOB through
- ✅ `shared/utils/projection-fire-calculator.ts` - Extracts and passes DOB from FIRE config
- ✅ `shared/utils/projection-simple.ts` - Accepts and uses DOB in projection calculations

## Phase 7: FIRE Chart Value Release Display ✅ COMPLETED

**Status:** ✅ Completed

### 7.1 Update FireProjectionData Schema ✅
**File:** `shared/schema/projections.ts` (lines 653-659)

**Completed enhancements:**
- ✅ Added optional `accessibleValue?: DecimalValueString` field
- ✅ Added optional `lockedValue?: DecimalValueString` field
- ✅ Fields represent aggregated accessible/locked values across all contributors

**Implementation details:**
```typescript
export type FireProjectionData = {
  age: number;
  portfolio: DecimalValueString;
  target: DecimalValueString;
  accessibleValue?: DecimalValueString; // Aggregated accessible value across all contributors
  lockedValue?: DecimalValueString; // Aggregated locked value across all contributors
};
```

### 7.2 Update Conversion Function ✅
**File:** `shared/utils/projection-utils.ts` (lines 351-390)

**Completed updates:**
- ✅ Updated `convertToAgeBasedProjection()` to extract `accessibleValue` and `lockedValue` from aggregated time points
- ✅ Properly converts DecimalValueString values from time points to FireProjectionData
- ✅ Handles cases where these fields are missing (optional fields)

### 7.3 Update FireChart Component ✅
**File:** `client/src/components/charts/FireChart.tsx`

**Completed features:**
- ✅ Added state management for toggle (default: show accessible value)
- ✅ Added data transformation to convert DecimalValueString to numbers for Recharts
- ✅ Added accessible value line with green dashed stroke (#10b981)
- ✅ Added toggle button that only appears when accessible value data exists
- ✅ Updated tooltip to show accessible value when available
- ✅ Updated line labels ("Total Portfolio" instead of "Portfolio Growth")
- ✅ Visual distinction: accessible value uses dashed green line vs solid blue for total portfolio

**Implementation details:**
- Toggle defaults to showing accessible value
- Chart works for both single and multiple contributors (uses aggregated values)
- Backward compatible: works when accessible value data is missing

## Phase 8: ProjectionResult Enhancements ✅ COMPLETED

**Status:** ✅ Completed

### 8.1 Add Total Bonuses to ProjectionResult ✅
**File:** `shared/schema/projections.ts` (lines 494-496)

**Completed enhancements:**
- ✅ Added `totalBonuses: DecimalValueString` field to `projectionResultSchema`
- ✅ Field is required (always present, defaults to zero if no bonuses)
- ✅ Represents total bonuses applied across all contributors

**Implementation details:**
```typescript
export const projectionResultSchema = z.object({
  // ... existing fields ...
  totalBonuses: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total bonuses must be a valid decimal string",
  }), // Total bonuses applied across all contributors (zero if no bonuses)
  // ... rest of schema ...
});
```

### 8.2 Update Orchestrator to Calculate Total Bonuses ✅
**File:** `shared/utils/projection-orchestrator.ts` (lines 393-440)

**Completed updates:**
- ✅ Extracts `totalBonuses` from last aggregated time point
- ✅ Defaults to zero if no bonuses exist
- ✅ Includes in result object as DecimalValueString
- ✅ Updated growth calculation to account for separate user contributions and bonuses

### 8.3 Refactor Total Contributions to Exclude Bonuses ✅
**Files:** 
- `shared/utils/projection-utils.ts` (lines 91-179)
- `shared/utils/projection-simple.ts` (lines 199-209, 326-332)
- `shared/utils/projection-orchestrator.ts` (lines 397-403)

**Completed refactoring:**
- ✅ `totalContributions` now represents user money input only (excluding bonuses)
- ✅ Bonuses are tracked separately in `totalBonuses`
- ✅ Modifiers applied proportionally to both user contributions and bonuses
- ✅ Portfolio value calculation: `value = currentValue + growth + userContributions + bonuses`
- ✅ Growth calculation: `growth = totalProjectedValue - currentValue - userContributions - bonuses`

**Key Changes:**
1. **`calculatePeriodContributions()`**: 
   - Tracks user contributions separately from bonuses
   - Applies modifiers proportionally to both
   - Returns user contributions (with modifiers) and bonuses (with modifiers) separately

2. **Portfolio Value Calculation**:
   - Linear projection: `accumulatedValue = currentValue + growth + totalContributions + totalBonuses`
   - Compound projection: `projectedValue = currentValue + growth + periodContributions + periodBonuses`

3. **Growth Calculation**:
   - Updated to subtract both user contributions and bonuses from total projected value

**Result:**
- Clear separation: `totalContributions` = user money only, `totalBonuses` = government/provider bonuses
- Accurate breakdown: `totalProjectedValue = totalCurrentValue + totalContributions + totalBonuses + totalGrowth`
- Modifiers applied consistently to both user contributions and bonuses proportionally

## Phase 9: Testing

### 9.1 Unit Tests for Bonus Calculator
**New file:** `shared/utils/projection-bonus-calculator.test.ts`

**Test cases:**
- Percentage bonus calculation (25% of £1,000 = £250)
- Fixed bonus calculation (£100 fixed bonus)
- Annual limit enforcement (LISA: £4,000 contributions = £1,000 bonus max)
- Multiple bonuses on same contribution
- Zero contribution handling
- Exceeding annual limit (bonus capped at limit)
- Tax year boundary handling

### 9.2 Unit Tests for Value Release Checker
**New file:** `shared/utils/projection-value-release.test.ts`

**Test cases:**
- Age-based eligibility (60+, 55+, 18+)
- Date-based eligibility
- Penalty calculation (25% LISA penalty)
- Multiple release points (use most favorable)
- Penalty rule comparators (lt, lte, gt, gte, eq, neq)
- Edge cases: exact age match, day before/after

### 9.3 Integration Tests
**Update file:** `shared/utils/projection-fire-calculator-p.test.ts`

**Test scenarios:**
- LISA with 25% bonus and 60+ release point
- LISA early withdrawal penalty calculation
- SIPP with 55+ release point (no penalty, just restriction)
- ISA with no restrictions (flexible access)
- Multiple contributors with different rules

### 9.4 End-to-End Projection Tests
**New file:** `shared/utils/projection-bonus-value-release.test.ts`

**Test scenarios:**
- Full projection with bonuses applied at each contribution
- Annual bonus limit tracking across tax year boundaries
- Accessible value calculation at various time points
- Penalty calculations for early withdrawal scenarios
- Multiple contributors with different bonus/release rules

## Phase 10: Documentation & Examples

### 10.1 Update Schema Documentation
**File:** `shared/schema/projections.ts`

**Add inline documentation:**
- Document bonus value examples with UK investment accounts
- Document value release examples (LISA, SIPP, ISA, JISA)
- Document penalty rule examples
- Add JSDoc comments to all functions

### 10.2 Create UK Investment Examples
**New file:** `docs/UK-Investments-Projections.md`

**Document examples:**
- **LISA Example:**
  - 25% government bonus on contributions
  - £4,000 annual contribution limit
  - £1,000 annual bonus limit
  - Release at age 60+ (no penalty)
  - 25% penalty for early withdrawal
  
- **SIPP Example:**
  - Access from age 55 (rising to 57)
  - 25% tax-free lump sum
  - Remaining 75% taxed as income
  
- **ISA Example:**
  - No bonuses
  - Flexible access (anytime, no penalty)
  
- **Junior ISA Example:**
  - No bonuses
  - Release at age 18 (cannot withdraw before)

## Phase 11: Client-Side Considerations ✅ COMPLETED

**Status:** ✅ Completed (minimal contributor support)

### 11.1 Update Client Projection Utilities ✅
**File:** `shared/utils/projection-client.ts`

**Updated functions:**
- ✅ `computeClientFireProjection()` - Creates minimal contributor for client-side projections
- ✅ `ProjectionClient.compute()` - Creates minimal contributor for client-side projections

**Implementation:**
- Client-side utilities create minimal `Contributor` objects with:
  - Empty `valueReleases: []`
  - Empty `bonusValues: []`
  - Default account type "GIA"
  - This allows client-side projections to work without full contributor data
  - When bonuses/releases are needed, full contributor data should be provided from server

**Note:** Client-side projections will work but won't calculate bonuses or value releases unless full contributor data is provided. This is acceptable as client-side projections are typically used for quick "what-if" scenarios.

### 11.2 UI Display Considerations (Future)
**Considerations for UI (not in scope for this plan):**
- Show accessible value vs total value
- Display bonus breakdown per time point
- Show penalty warnings if accessing early
- Highlight locked value until release date
- Visual indicators for value release points

## Implementation Order

1. **Phase 1:** Schema enhancements (if needed)
2. **Phase 2:** Bonus value calculator (isolated, testable)
3. **Phase 3:** Value release checker (isolated, testable)
4. **Phase 6:** Date of birth context (needed for Phase 4)
5. **Phase 4:** Integration into time series
6. **Phase 5:** Update orchestrator
7. **Phase 7:** Testing
8. **Phase 8:** Documentation
9. **Phase 9:** Client-side (if needed)

## Key Design Decisions Needed

### Decision 1: Accessible Value Tracking ✅ DECIDED
**Question:** Should `ProjectionTimePoint` include separate `accessibleValue` and `lockedValue` fields?

**Decision:** ✅ Option a) - Added fields to schema for better UX and transparency

**Implementation:** Fields added to `projectionTimePointSchema` in Phase 1:
- `bonuses?: DecimalValueString`
- `accessibleValue?: DecimalValueString`
- `lockedValue?: DecimalValueString`

All fields are optional for backward compatibility.

### Decision 2: Date of Birth Location ✅ DECIDED
**Question:** Where should date of birth be passed?

**Decision:** ✅ Option b) - Pass as separate parameter for flexibility

**Implementation:** Added `dateOfBirth?: Date` to `ProjectionOrchestratorInput` in Phase 1.

**Rationale:**
- FIRE calculator already has DOB from `FIREProjectionConfig`
- Not all projections need DOB (only those with age-based value releases)
- More flexible for future use cases

### Decision 3: Annual Bonus Limits ✅ DECIDED
**Question:** Track per tax year (April 6 - April 5) or calendar year?

**Decision:** ✅ Option a) - UK tax year for accuracy

**Implementation:**
- ✅ `getTaxYearStart()` returns April 6 as tax year start
- ✅ `getTaxYearForDate()` returns tax year identifier (e.g., "2024-2025")
- ✅ Annual usage tracking resets per tax year
- ✅ Bonus limits enforced per UK tax year

### Decision 4: Multiple Bonuses ✅ DECIDED
**Question:** Should multiple bonuses stack or be mutually exclusive?

**Decision:** ✅ Option a) - Stack with individual limits per UK rules

**Implementation:**
- ✅ Bonuses are sorted by priority (lower number = higher priority)
- ✅ All bonuses are applied in priority order
- ✅ Each bonus has its own annual limits tracked separately
- ✅ Bonuses can stack if they don't conflict

### Decision 5: Penalty Application ✅ DECIDED
**Question:** When should penalties be calculated in projections?

**Decision:** ✅ Option c) - Track both total and accessible value

**Implementation:**
- ✅ Accessible value calculated at each time point
- ✅ Locked value calculated at each time point
- ✅ Both values stored in `ProjectionTimePoint`
- ✅ Allows UI to display both total and accessible values

## Potential Challenges

1. **Annual Limit Tracking:** Need to track bonus usage across tax years within a projection period
   - Solution: Map<bonusName, Map<taxYear, usage>> tracking structure

2. **Age Calculation:** Accurate age calculation at each time point (consider leap years, exact dates)
   - Solution: Use date-fns `differenceInYears` or custom age calculation

3. **Performance:** Additional calculations at each time point may impact performance
   - Solution: Optimize calculations, consider caching if needed

4. **Tax Year Boundaries:** Handle tax year transitions correctly during projection
   - Solution: Track tax year start dates and reset annual usage appropriately

5. **Multiple Release Points:** Determine which release point applies (e.g., LISA: 60+ OR first home)
   - Solution: Use most favorable (earliest accessible) release point

## UK Investment Account Mappings

### Lifetime ISA (LISA)
- **Bonus:** 25% on contributions (up to £4,000/year = £1,000 bonus/year)
- **Release Points:** Age 60+, first home purchase (up to £450k), terminal illness
- **Penalty:** 25% withdrawal charge for early access

### SIPP / Personal Pension
- **Bonus:** None (tax relief handled separately)
- **Release Points:** Age 55 (rising to 57 from April 2028)
- **Penalty:** None (but 75% taxed as income on withdrawal)

### ISA (Stocks & Shares / Cash)
- **Bonus:** None
- **Release Points:** Flexible (anytime)
- **Penalty:** None

### Junior ISA (JISA)
- **Bonus:** None
- **Release Points:** Age 18
- **Penalty:** Cannot withdraw before age 18

## Success Criteria

1. ✅ Bonus values are correctly applied to contributions
2. ✅ Annual bonus limits are tracked and enforced (per UK tax year)
3. ✅ Value release points are checked at each projection time point
4. ✅ Penalties are correctly calculated for early access
5. ✅ Accessible value is calculated and tracked separately
6. ✅ Accessible value displayed in FIRE chart with toggle functionality
7. ✅ Total bonuses tracked in ProjectionResult (always present, zero if none)
8. ✅ User contributions separated from bonuses in tracking
9. ✅ All UK investment account types can be accurately modeled with schema
10. ⏳ Tests cover all scenarios and edge cases (PENDING)
11. ⏳ Documentation includes examples for all account types (PENDING)

## Implementation Summary

### Completed Work

**New Files Created:**
- ✅ `shared/utils/projection-bonus-calculator.ts` - Bonus calculation logic with tax year tracking
- ✅ `shared/utils/projection-value-release.ts` - Value release eligibility and penalty calculation
- ✅ `shared/utils/projection-accessible-value.ts` - Accessible vs locked value calculation

**Files Modified:**
- ✅ `shared/schema/projections.ts` - Enhanced schemas (Phase 1, Phase 7, Phase 8)
- ✅ `shared/utils/projection-utils.ts` - Updated contribution calculation, time point creation, and age-based conversion (Phase 2, Phase 7, Phase 8)
- ✅ `shared/utils/projection-simple.ts` - Integrated bonuses and value releases, separated user contributions from bonuses (Phase 4, Phase 8)
- ✅ `shared/utils/projection-orchestrator.ts` - Passes contributor and DOB, aggregates new fields, calculates totalBonuses (Phase 5, Phase 8)
- ✅ `shared/utils/projection-fire-calculator.ts` - Passes DOB from FIRE config (Phase 6)
- ✅ `shared/utils/projection-client.ts` - Creates minimal contributors for client-side projections (Phase 11)
- ✅ `client/src/components/charts/FireChart.tsx` - Added accessible value line with toggle (Phase 7)
- ✅ `shared/utils/projection-fire-calculator-p.test.ts` - Updated test to match new schema (Phase 1)
- ✅ `shared/utils/projection-simple-generateSimpleProjection.test.ts` - Updated test to include contributor (Phase 4)

### Key Features Implemented

1. **Bonus Value System:**
   - Percentage and fixed bonuses
   - Annual contribution limits (e.g., LISA £4,000)
   - Annual bonus limits (e.g., LISA £1,000)
   - Priority-based ordering for multiple bonuses
   - UK tax year tracking (April 6 - April 5)

2. **Value Release System:**
   - Age-based release points (e.g., 60+, 55+, 18+)
   - Date-based release points
   - Multiple release points per contributor
   - Exception handling (special cases like "first_home")

3. **Penalty System:**
   - Percentage penalties (e.g., 25% LISA penalty)
   - Fixed penalties
   - Rule-based penalty application (comparators: lt, lte, gt, gte, eq, neq)
   - Penalty calculation at each time point

4. **Accessible Value Tracking:**
   - Calculates accessible value at each time point
   - Calculates locked value at each time point
   - Handles multiple release points (uses most favorable)
   - Applies penalties for early access scenarios

5. **FIRE Chart Integration:**
   - Displays accessible value as separate line in FIRE chart
   - Toggle to show/hide accessible value (default: visible)
   - Visual distinction with dashed green line
   - Works with aggregated values across multiple contributors

6. **ProjectionResult Enhancements:**
   - `totalBonuses` field tracks total bonuses applied across all contributors
   - `totalContributions` now represents user money only (excluding bonuses)
   - Clear breakdown: `totalProjectedValue = currentValue + contributions + bonuses + growth`

### Remaining Work

- ⏳ **Phase 9: Testing** - Comprehensive unit and integration tests needed
- ⏳ **Phase 10: Documentation** - Examples and usage documentation needed

