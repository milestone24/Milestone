# Frontend-Backend Domain Model Alignment Plan

## Executive Summary

The frontend React application (particularly the `fire.tsx` page) does not align with the backend's new domain model based on the `Contributor` abstraction. This plan outlines the steps to refactor the frontend to use the backend as the single source of truth for projection calculations.

## Current State Analysis

### Backend Domain Model (Source of Truth)

**Core Concepts:**
- **Contributor**: Represents any source of value contribution (assets, pensions, etc.)
  - Contains: `schedules`, `bonusValues`, `valueReleases`, `currentValue`, `accountType`
  - Handles UK-specific features (LISA bonuses, pension age restrictions, etc.)
- **ProjectionResult**: Complete projection data
  - All values as `DecimalValueString` for precision
  - `timePoints` include `accessibleValue` and `lockedValue`
  - `contributorBreakdown` shows per-contributor projections
  - `computationContext` provides data for client-side adjustments
- **FIREProjectionResult**: Extends projection with FIRE-specific metrics
  - Contains full `projectionResult`
  - Includes `fireNumber`, retirement dates, shortfall calculations

### Frontend Current Issues

**File: `client/src/pages/fire.tsx`**

1. **Manual Contribution Extraction** (Lines 167-171)
   - Extracts `schedules` from `computationContext.contributors`
   - Loses `bonusValues`, `valueReleases`, and account-specific logic
   - Creates incomplete contributor model

2. **Client-Side Projection Duplication** (Lines 208-215)
   - Uses `computeClientFireProjection` with minimal contributor
   - Ignores server-calculated `timePoints` with accessible/locked values
   - Recalculates what server already computed

3. **Type Inconsistencies**
   - Mixes `number` and `DecimalValueString`
   - `fireNumber` conversion issues
   - Manual form state (`tempFormState`) instead of using projection results

4. **Missing Feature Utilization**
   - Server provides `accessibleValue` and `lockedValue` in `timePoints`
   - Frontend doesn't use them
   - Chart component supports these but data isn't provided

5. **Incorrect Data Flow**
   - Should use `projectionResult.timePoints` from `FIREProjectionResult`
   - Should use `convertToAgeBasedProjection` utility
   - Currently bypasses server calculations

## Implementation Plan

### Phase 1: Fix Core Data Flow in `fire.tsx`

**Goal**: Use server-provided projection data as the primary source

**Changes:**

1. **Remove Manual Contribution Extraction**
   - Delete lines 167-171 (contributionsForFire extraction)
   - Remove dependency on manually extracted schedules

2. **Use Server ProjectionResult Directly**
   - Extract `projectionResult` from `FIREProjectionResult`
   - Use `projectionResult.timePoints` instead of client-side calculation
   - Convert using existing `convertToAgeBasedProjection` utility

3. **Fix Data Extraction from Hook**
   ```typescript
   const {
     fireNumber,
     projectedRetirementDate,
     projectedRetirementAge,
     yearsAheadOrBehind,
     monthlyShortfall,
     projectionResult, // Full ProjectionResult with timePoints
   } = currentProjection ?? {};
   ```

4. **Convert TimePoints to FireProjectionData**
   ```typescript
   import { convertToAgeBasedProjection } from "@shared/utils/projection-utils";
   
   const fireProjectionData = user?.profile?.dob && projectionResult
     ? convertToAgeBasedProjection(
         projectionResult.timePoints,
         user.profile.dob,
         createDecimalValueString(fireNumber.toString())
       )
     : [];
   ```

**Expected Outcome:**
- Chart displays server-calculated data
- Accessible/locked values visible
- Bonuses and value releases included

### Phase 2: Update Type Handling

**Goal**: Ensure consistent type usage throughout

**Changes:**

1. **Standardize DecimalValueString Usage**
   - Convert `fireNumber` (number) to `DecimalValueString` when needed
   - Ensure all calculations use `Decimal` from decimal.js

2. **Update Variable Names**
   - Replace `tempFormState` with direct usage of projection results
   - Use `projectionResult.totalCurrentValue` instead of `portfolioOverview?.value`

3. **Fix Contribution Impact Calculations**
   - Update `calculateContributionImpactWithProjections` calls
   - Ensure proper type conversions

**Files to Modify:**
- `client/src/pages/fire.tsx` (lines 89-98, 220-247)

### Phase 3: Update Contribution Adjustment Logic

**Goal**: Use full contributor model for adjustments

**Changes:**

1. **Use ComputationContext for Adjustments**
   - Access `projectionResult.computationContext.contributors`
   - Create adjusted contributors when user modifies investment amount
   - Use adjusted contributors for preview calculations

2. **Update Contribution Impact Function**
   - Modify `calculateContributionImpactWithProjections` in `projection-client.ts`
   - Accept `Contributor[]` instead of `ContributorSchedule[]`
   - Preserve bonuses and value releases in calculations

3. **Preview vs. Save Pattern**
   - Preview: Use client-side calculation with adjusted contributors
   - Save: Send to server for authoritative projection

**Files to Modify:**
- `client/src/pages/fire.tsx` (lines 231-247, 255-271)
- `shared/utils/projection-client.ts` (update function signatures)

### Phase 4: Remove Legacy Client-Side Calculations

**Goal**: Keep client-side calculations only for previews

**Changes:**

1. **Remove Main Chart Client Calculation**
   - Delete `computeClientFireProjection` call for main display (line 208)
   - Keep only for "what-if" scenarios

2. **Documentation**
   - Add comments explaining when to use client vs. server calculations
   - Clarify that server is source of truth

**Files to Modify:**
- `client/src/pages/fire.tsx` (line 208)
- `shared/utils/projection-client.ts` (add documentation)

### Phase 5: Verify FireChart Component Compatibility

**Goal**: Ensure chart component receives correct data structure

**Changes:**

1. **Verify Data Structure**
   - Confirm `FireProjectionData[]` includes `accessibleValue` and `lockedValue`
   - Check that `convertToAgeBasedProjection` preserves these fields

2. **Test Chart Display**
   - Verify accessible value toggle works
   - Ensure locked value displays correctly
   - Test retirement age markers

**Files to Review:**
- `client/src/components/charts/FireChart.tsx` (verify, likely no changes needed)
- `shared/utils/projection-utils.ts` (verify `convertToAgeBasedProjection`)

## Detailed Implementation Steps

### Step 1: Update `fire.tsx` Data Extraction

**Location**: Lines 141-217

**Changes:**
1. Remove `computeClientFireProjection` import if not used elsewhere
2. Import `convertToAgeBasedProjection` from `@shared/utils/projection-utils`
3. Extract `projectionResult` from `currentProjection`
4. Replace manual contribution extraction with direct timePoints usage
5. Add null checks for `user.profile.dob` and `projectionResult`

### Step 2: Update Chart Data Preparation

**Location**: Lines 208-226

**Changes:**
1. Replace `fireProjectionData` calculation with `convertToAgeBasedProjection`
2. Use `projectionResult.timePoints` as input
3. Use `user.profile.dob` for age calculation
4. Use `fireNumber` converted to `DecimalValueString` for target

### Step 3: Update Contribution Impact Calculations

**Location**: Lines 231-247

**Changes:**
1. Extract full contributors from `computationContext`
2. Create adjusted contributors for impact calculations
3. Update function calls to pass `Contributor[]` instead of `ContributorSchedule[]`
4. Ensure proper type conversions

### Step 4: Update Helper Functions

**Location**: `shared/utils/projection-client.ts`

**Changes:**
1. Update `calculateContributionImpactWithProjections` signature
2. Accept `Contributor[]` instead of `ContributorSchedule[]`
3. Preserve bonuses and value releases in calculations
4. Add documentation comments

### Step 5: Testing Checklist

**Test Cases:**
1. ✅ Chart displays server-calculated projection data
2. ✅ Accessible value toggle shows correct values
3. ✅ Locked value displays correctly for age-restricted accounts
4. ✅ Bonuses are included in projections (e.g., LISA 25%)
5. ✅ Contribution adjustments show correct impact
6. ✅ Type conversions work correctly (number ↔ DecimalValueString)
7. ✅ Handles missing DOB gracefully
8. ✅ Handles missing projection data gracefully

## Risk Assessment

### Low Risk
- Using existing utilities (`convertToAgeBasedProjection`)
- Chart component already supports required data structure
- Type conversions are straightforward

### Medium Risk
- Contribution adjustment logic needs careful testing
- Need to ensure preview calculations match server results
- Multiple type conversions could introduce bugs

### Mitigation
- Test each phase incrementally
- Verify calculations match server results
- Add type guards and null checks
- Test edge cases (missing DOB, no assets, etc.)

## Success Criteria

1. ✅ Frontend uses server-calculated `timePoints` as primary data source
2. ✅ Chart displays accessible/locked values correctly
3. ✅ All bonuses and value releases are included in projections
4. ✅ Type consistency throughout (`DecimalValueString` where appropriate)
5. ✅ Contribution adjustments work with full contributor model
6. ✅ No duplicate calculations between client and server
7. ✅ Code is maintainable and follows backend domain model

## Dependencies

- Existing utilities: `convertToAgeBasedProjection` ✅
- Chart component: Already supports `FireProjectionData` with accessible/locked ✅
- Backend API: Returns correct `FIREProjectionResult` structure ✅
- Hook: `useFIREProjection` returns correct type ✅

## Estimated Effort

- Phase 1: 2-3 hours
- Phase 2: 1-2 hours
- Phase 3: 2-3 hours
- Phase 4: 1 hour
- Phase 5: 1 hour
- Testing: 2-3 hours

**Total: 9-13 hours**

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (core data flow)
3. Test incrementally after each phase
4. Document any deviations from plan
5. Complete all phases before final testing

---

## Appendix: Key Code Locations

### Backend Domain Model
- `shared/utils/projection-orchestrator.ts` - Main projection orchestration
- `shared/utils/projection-simple.ts` - Simple projection calculations
- `shared/utils/projection-fire-calculator.ts` - FIRE-specific calculations
- `shared/schema/projections.ts` - Type definitions

### Frontend Current Implementation
- `client/src/pages/fire.tsx` - Main FIRE page (needs refactoring)
- `client/src/hooks/use-projections.ts` - React Query hooks
- `client/src/components/charts/FireChart.tsx` - Chart component
- `shared/utils/projection-client.ts` - Client-side utilities (needs updates)

### Utilities
- `shared/utils/projection-utils.ts` - Contains `convertToAgeBasedProjection`
- `shared/utils/projection-accessible-value.ts` - Accessible value calculations

---

**Document Version**: 1.0  
**Created**: 2025-01-27  
**Last Updated**: 2025-01-27

