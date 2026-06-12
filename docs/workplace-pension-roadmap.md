# Workplace Pension Integration Roadmap

**Status:** Planning  
**Last Updated:** 2025-01-XX  
**Related Documents:** 
- [UK-Investments.md](./UK-Investments.md)
- [projections-plan.md](./projections-plan.md)
- [Projections-Implementation-Status.md](./Projections-Implementation-Status.md)

---

## Executive Summary

This document outlines the roadmap for integrating workplace pensions as a contributor type in the projection system. **Important:** Workplace pensions are contributors (like state pensions), not user assets, and therefore do not require an account type. They have unique characteristics including tax relief on contributions, employer matching, age-based access restrictions, and complex withdrawal tax rules.

**Key Requirements:**
- Tax relief on contributions (20% basic rate, 40%/45% higher/additional rate)
- Employer contribution matching
- Age-based value release (55, rising to 57 from April 2028)
- Withdrawal tax rules (25% tax-free lump sum, 75% taxed as income)
- Annual allowance limits (£60,000 or 100% of earnings)

---

## 1. Current State Assessment

### 1.1 What's Already Supported

✅ **Contributor Type**
- `"workplace_pension"` is defined in `contributionTypes` enum
- Contributor schema supports all required fields

✅ **Value Release System**
- Age-based restrictions are fully implemented
- Penalty system for early access exists
- Used successfully for SIPP (age 55/57 restriction)

✅ **Bonus System**
- Supports percentage and fixed bonuses
- Annual limits and contribution limits
- Tax year tracking (UK tax year: April 6)
- Priority-based application

✅ **Tax Schema**
- `taxSchema` exists with predicates (age/date-based)
- Supports percentage and fixed tax rates
- Can be attached to contributors

### 1.2 What's Missing

❌ **Tax Relief Implementation**
- Tax relief not modeled as bonuses
- No automatic 20% basic rate relief
- No higher/additional rate relief calculation
- No employer contribution matching logic

❌ **Withdrawal Tax Calculation**
- `taxes` field exists but not used in calculations
- No implementation for 25% tax-free lump sum (PCLS)
- No income tax calculation on 75% taxable portion
- No marginal rate tax calculation

❌ **Helper Functions**
- No `defineWorkplacePensionBonuses()` function
- No `defineWorkplacePensionValueReleases()` function
- No `createWorkplacePensionContributor()` helper

❌ **Database Schema (Optional)**
- No workplace pension-specific storage (may not be needed if managed as contributors only)
- No employer contribution tracking in database
- No tax relief rate storage in database
- **Note:** Workplace pensions may be stored as contributor configurations rather than database entities

---

## 2. UK Workplace Pension Requirements

### 2.1 Contribution Tax Relief

**Basic Rate (20%)**
- Automatic relief at source
- For every £80 contributed, £100 goes into pension
- Effectively a 25% bonus on net contribution

**Higher Rate (40%) / Additional Rate (45%)**
- Claimed via self-assessment
- Additional 20% or 25% relief on top of basic rate
- Requires user's marginal tax rate input

**Annual Allowance**
- £60,000 per tax year (2024/2025)
- Or 100% of earnings (whichever is lower)
- Includes both employee and employer contributions

### 2.2 Employer Contributions

**Typical Scenarios:**
- Matched contributions (e.g., 100% match up to 5% of salary)
- Fixed percentage (e.g., 3% of salary regardless of employee contribution)
- Tiered matching (e.g., 50% match up to 3%, 100% match 3-5%)

**Modeling Approach:**
- Option A: Model as bonus (percentage of employee contribution)
- Option B: Model as separate schedule (fixed amount/percentage)
- **Recommendation:** Option A (bonus) for simplicity, Option B for accuracy

### 2.3 Access Restrictions

**Minimum Pension Age**
- Currently: Age 55
- From April 6, 2028: Age 57
- 100% locked before minimum age (no exceptions)

**Implementation:**
- Use existing value release system
- Similar to SIPP implementation
- Date-based check for April 2028 threshold

### 2.4 Withdrawal Tax Rules

**Tax-Free Lump Sum (PCLS)**
- Up to 25% of pension pot
- Taken as single lump sum or in stages
- No tax on this portion

**Taxable Portion (75%)**
- Added to annual income
- Taxed at marginal rate:
  - Basic rate: 20%
  - Higher rate: 40%
  - Additional rate: 45%
- Personal allowance applies

**Money Purchase Annual Allowance (MPAA)**
- If flexible access taken, future contributions limited to £10,000/year
- **Note:** Not implementing in Phase 1 (future enhancement)

---

## 3. Implementation Roadmap

### Phase 1: Foundation (Core Support)

**Goal:** Enable basic workplace pension projections with tax relief and access restrictions

**Note:** Workplace pensions are contributors, not user assets, so no account type changes are needed. They will use `contributor.type === "workplace_pension"` and can use any account type for display purposes (e.g., `"SIPP"` for similarity) or a placeholder value.

#### 3.1.1 Tax Relief Bonus Implementation
- [ ] Create `defineWorkplacePensionTaxReliefBonuses()` function
- [ ] Implement basic rate relief (20% = 25% bonus on net)
- [ ] Add user-configurable marginal tax rate for higher/additional relief
- [ ] Implement annual allowance limit (£60,000)
- [ ] Add tax year tracking
- **Files:**
  - `shared/utils/projection-utils.ts`
  - `shared/schema/projections.ts` (if config needed)

#### 3.1.2 Employer Contribution Bonus
- [ ] Create `defineWorkplacePensionEmployerBonus()` function
- [ ] Support percentage matching (e.g., 100% match)
- [ ] Support tiered matching (future: Phase 2)
- [ ] Add employer contribution limit (if applicable)
- **Files:**
  - `shared/utils/projection-utils.ts`

#### 3.1.3 Value Release Configuration
- [ ] Create `defineWorkplacePensionValueReleases()` function
- [ ] Implement age 55 restriction (current)
- [ ] Implement age 57 restriction (from April 2028)
- [ ] Add date-based logic for threshold
- **Files:**
  - `shared/utils/projection-utils.ts`

#### 3.1.4 Helper Function
- [ ] Create `createWorkplacePensionContributor()` function
- [ ] Combine bonuses, value releases, schedules
- [ ] Set `type: "workplace_pension"` and appropriate `accountType` for display (e.g., `"SIPP"` for similarity)
- [ ] Handle contributor configuration without requiring database asset
- **Files:**
  - `shared/utils/projection-utils.ts`

**Deliverables:**
- Workplace pensions can be added as contributors
- Tax relief automatically applied
- Employer matching supported
- Age-based access restrictions enforced
- Basic projections working

**Estimated Effort:** 2-3 days

---

### Phase 2: Withdrawal Tax Implementation

**Goal:** Implement accurate withdrawal tax calculations

#### 3.2.1 Tax Calculation Engine
- [ ] Create `calculateWithdrawalTax()` function
- [ ] Implement 25% tax-free lump sum (PCLS)
- [ ] Calculate taxable portion (75%)
- [ ] Apply marginal tax rate to taxable portion
- [ ] Support staged withdrawals
- **Files:**
  - `shared/utils/projection-withdrawal-tax.ts` (new file)

#### 3.2.2 Tax Schema Integration
- [ ] Implement tax application in projection calculations
- [ ] Apply taxes at value release points
- [ ] Calculate accessible value after tax
- [ ] Update `calculateAccessibleValue()` to handle taxes
- **Files:**
  - `shared/utils/projection-accessible-value.ts`
  - `shared/utils/projection-simple.ts`

#### 3.2.3 User Tax Rate Configuration
- [ ] Add marginal tax rate to user profile/settings
- [ ] Support basic (20%), higher (40%), additional (45%)
- [ ] Allow per-contributor override
- **Files:**
  - `shared/schema/user-account.ts` (if needed)
  - `shared/schema/projections.ts` (contributor-level)

#### 3.2.4 Projection Time Point Updates
- [ ] Add `taxFreeAmount` to `ProjectionTimePoint`
- [ ] Add `taxableAmount` to `ProjectionTimePoint`
- [ ] Add `taxAmount` to `ProjectionTimePoint`
- [ ] Update schema and types
- **Files:**
  - `shared/schema/projections.ts`
  - `shared/utils/projection-utils.ts`

**Deliverables:**
- Accurate withdrawal tax calculations
- Tax-free and taxable amounts shown in projections
- Marginal tax rate support
- Staged withdrawal support

**Estimated Effort:** 3-4 days

---

### Phase 3: Enhanced Features

**Goal:** Advanced workplace pension features

#### 3.3.1 Tiered Employer Matching
- [ ] Support multiple matching tiers
- [ ] Example: 50% match up to 3%, 100% match 3-5%
- [ ] Update bonus calculation logic
- **Files:**
  - `shared/utils/projection-utils.ts`
  - `shared/schema/projections.ts`

#### 3.3.2 Salary-Based Contributions
- [ ] Support percentage of salary contributions
- [ ] Link to user profile salary
- [ ] Automatic calculation from salary
- **Files:**
  - `shared/schema/user-account.ts`
  - `shared/utils/projection-utils.ts`

#### 3.3.3 Money Purchase Annual Allowance (MPAA)
- [ ] Track if flexible access taken
- [ ] Reduce annual allowance to £10,000
- [ ] Apply to future contributions
- **Files:**
  - `shared/schema/projections.ts`
  - `shared/utils/projection-utils.ts`

#### 3.3.4 Pension Drawdown Modeling
- [ ] Support flexible income withdrawals
- [ ] Model ongoing drawdown payments
- [ ] Calculate remaining pot value
- **Files:**
  - `shared/utils/projection-drawdown.ts` (new file)

**Deliverables:**
- Advanced matching scenarios
- Salary-linked contributions
- MPAA compliance
- Drawdown modeling

**Estimated Effort:** 4-5 days

---

### Phase 4: UI Integration

**Goal:** User interface for workplace pension management

#### 3.4.1 Workplace Pension Form
- [ ] Create workplace pension creation/editing form
- [ ] Employee contribution input
- [ ] Employer match configuration
- [ ] Tax relief rate selection
- [ ] Access age configuration
- **Files:**
  - `client/src/components/workplace-pension/` (new directory)

#### 3.4.2 Projection Display Updates
- [ ] Show tax relief in projection breakdown
- [ ] Display employer contributions separately
- [ ] Show tax-free vs taxable amounts
- [ ] Highlight accessible value changes at age 55/57
- **Files:**
  - `client/src/components/projections/`
  - `client/src/pages/fire.tsx`

#### 3.4.3 FIRE Integration
- [ ] Include workplace pensions in FIRE calculations
- [ ] Show accessible value at retirement age
- [ ] Account for withdrawal taxes in FIRE number
- **Files:**
  - `client/src/pages/fire.tsx`
  - `shared/utils/projection-fire-calculator.ts`

**Deliverables:**
- Complete UI for workplace pension management
- Integrated projections display
- FIRE calculations including workplace pensions

**Estimated Effort:** 3-4 days

---

## 4. Technical Design Decisions

### 4.1 Contributor vs Asset Strategy

**Approach: Workplace Pensions as Contributors Only**
- Workplace pensions are **not user assets** - they are external contributors (like state pensions)
- Use `contributor.type === "workplace_pension"` to identify them
- For display/UI purposes, can use `accountType: "SIPP"` to leverage existing SIPP styling/logic
- No database schema changes needed for account types
- Contributors can be stored in computation context or as separate configuration entities
- **Rationale:** Matches the conceptual model - workplace pensions are managed by employers, not directly by users as assets

### 4.2 Tax Relief Modeling

**Approach: Model as Bonuses**
- Basic rate: 20% tax relief = 25% bonus on net contribution
- Higher rate: Additional 20% = additional 25% bonus
- **Rationale:** Consistent with existing bonus system, annual limits already supported

### 4.3 Employer Contribution Modeling

**Approach: Model as Bonus (Phase 1), Separate Schedule (Phase 3)**
- Phase 1: Simple percentage match as bonus
- Phase 3: Complex tiered matching as separate schedule
- **Rationale:** Incremental complexity, matches user mental model

### 4.4 Withdrawal Tax Calculation

**Approach: Apply at Value Release Point**
- Calculate tax when value becomes accessible (age 55/57)
- Store tax-free and taxable amounts in time points
- **Rationale:** Matches UK pension rules, clear separation of concerns

---

## 5. Database Schema Changes

### 5.1 No Account Type Changes Required

**Workplace pensions do not require account type changes** because they are contributors, not user assets. The `contributor.type` field already supports `"workplace_pension"`.

**Optional: Contributor Storage**
- If workplace pensions need to be persisted, consider a separate `contributors` table or store in user settings
- Alternatively, they can be managed entirely in-memory as part of projection computation context
- **Decision needed:** Do workplace pensions need database persistence or can they be user-configured only?

### 5.2 User Profile Extensions (Phase 2)

```typescript
// Optional: Add to user profile for default tax rate
marginalTaxRate: z.enum(["basic", "higher", "additional"]).optional()
```

**Migration Required:** Optional  
**Breaking Change:** No

---

## 6. Testing Requirements

### 6.1 Unit Tests

- [ ] Tax relief bonus calculation
- [ ] Employer contribution bonus
- [ ] Value release age restrictions
- [ ] Withdrawal tax calculations
- [ ] Annual allowance limits
- [ ] Tax year boundary handling

**Files:**
- `shared/utils/projection-utils.test.ts`
- `shared/utils/projection-withdrawal-tax.test.ts` (new)

### 6.2 Integration Tests

- [ ] Full workplace pension projection
- [ ] Multiple contributors (workplace pension + other assets)
- [ ] FIRE calculations with workplace pension
- [ ] Milestone tracking with workplace pension

**Files:**
- `server/services/projections/projections.test.ts`

### 6.3 Edge Cases

- [ ] Contributions exceeding annual allowance
- [ ] Age 55 vs 57 threshold (April 2028)
- [ ] Tax relief at different marginal rates
- [ ] Zero employer match
- [ ] Staged withdrawals

---

## 7. Documentation Updates

### 7.1 Code Documentation

- [ ] JSDoc comments for new functions
- [ ] Type definitions and schemas
- [ ] Usage examples in code comments

### 7.2 User Documentation

- [ ] Update UK-Investments.md with workplace pension details
- [ ] Add workplace pension guide
- [ ] Update projection documentation

### 7.3 API Documentation

- [ ] Update API route documentation
- [ ] Example requests/responses
- [ ] Error handling documentation

---

## 8. Risk Assessment

### 8.1 Technical Risks

**Risk:** Tax calculation complexity  
**Mitigation:** Start with basic rate only, add higher rates incrementally

**Risk:** Annual allowance tracking  
**Mitigation:** Reuse existing bonus annual limit system

**Risk:** Age 55/57 threshold logic  
**Mitigation:** Use date-based check, test thoroughly

### 8.2 Business Risks

**Risk:** Incorrect tax calculations  
**Mitigation:** Clear disclaimers, professional advice recommendations

**Risk:** Regulatory changes  
**Mitigation:** Make tax rates configurable, version control rules

---

## 9. Success Criteria

### Phase 1 Success
- ✅ Workplace pensions can be added as contributors
- ✅ Tax relief automatically calculated and applied
- ✅ Employer matching supported
- ✅ Age-based access restrictions enforced
- ✅ Basic projections working end-to-end

### Phase 2 Success
- ✅ Accurate withdrawal tax calculations
- ✅ Tax-free and taxable amounts displayed
- ✅ Marginal tax rate support
- ✅ Accessible value correctly calculated

### Phase 3 Success
- ✅ All advanced features working
- ✅ UI fully integrated
- ✅ FIRE calculations accurate
- ✅ Comprehensive test coverage

---

## 10. Timeline Estimate

**Phase 1 (Foundation):** 2-3 days  
**Phase 2 (Withdrawal Tax):** 3-4 days  
**Phase 3 (Enhanced Features):** 4-5 days  
**Phase 4 (UI Integration):** 3-4 days  

**Total Estimated Effort:** 12-16 days

**Recommended Approach:** Implement Phase 1 first, gather user feedback, then proceed with subsequent phases.

---

## 11. Open Questions

1. **Storage:** Do workplace pensions need database persistence, or can they be user-configured only (stored in computation context)?
2. **Account Type for Display:** Should we use `"SIPP"` as the accountType for workplace pensions (for UI consistency) or a placeholder value?
3. **Tax Relief:** Should higher/additional rate relief be automatic or require user input?
4. **Employer Match:** Should we support complex tiered matching in Phase 1 or defer to Phase 3?
5. **Withdrawal Tax:** Should we model staged withdrawals in Phase 2 or defer?
6. **MPAA:** Is Money Purchase Annual Allowance needed for MVP?

---

## 12. References

- [UK-Investments.md](./UK-Investments.md) - UK tax rules and regulations
- [projections-plan.md](./projections-plan.md) - Overall projection system design
- [Projections-Implementation-Status.md](./Projections-Implementation-Status.md) - Current implementation status
- [projections-bonus-value-releases-plan.md](./projections-bonus-value-releases-plan.md) - Bonus and value release system

---

**Document Owner:** Development Team  
**Reviewers:** Product, QA  
**Next Review Date:** After Phase 1 completion

