# FIRE Page Development Plan

## Executive Summary

This document outlines all issues, improvements, and implementation steps needed to make the FIRE (Financial Independence, Retire Early) page production-ready. The analysis covers current functionality, identifies critical bugs, proposes enhancements, and provides detailed implementation specifications.

---

## Status Update (2025-11-10)

### ✅ Completed
- Projection config now respects form values, preview modifiers, and growth-mode preference.
- Investment adjustments run in true preview mode with apply/cancel/reset controls.
- Loading and error states surface via dedicated skeleton/error components.
- Projection chart visibility toggles with persisted preference and inline badge.
- Growth mode toggle shows active state with helper messaging.
- Expanded summary cards cover retirement status, withdrawal readiness, contribution plan, and access breakdown with preview indicators.
- Preview modifiers panel surfaces contribution scaler, inflation override, presets, and active-status badge.
- Standalone contributor preview supports custom/preset contributors with local persistence and mode toggle.
- Fire settings summary card with collapsible editor provides draft indication and links to preview modifiers.
- Projection requests are debounced client-side; settings updates invalidate the FIRE projection cache for fresh results.
- Summary view now includes contribution breakdown by account type, state pension visibility, and progress indicators.
- Error handling surfaces friendly messaging with actionable next steps and retry controls.

### 🔄 In Progress / Outstanding
- Advanced options (scenario comparison, performance optimisations).  
  *(Compound growth selector and adjustable inflation controls are deferred beyond MVP; linear mode remains default.)*
- Contribution breakdown visualisations & bonus impact charts.
- Expanded error/edge-case handling, accessibility polish, and comprehensive testing (unit/integration/E2E).

---

## 1. Current System Analysis

### 1.1 Backend Architecture

**Projection Service** (`server/services/projections/index.ts`):
- `checkFIREFeasibility()` - Uses saved FIRE settings from database
- `projectToRetirement()` - Projects portfolio to retirement with custom config
- Returns `FireProjection` with feasibility analysis, shortfall calculations, and age-based projection data
- Handles bonuses (e.g., LISA 25% government bonus), value releases (age-based access restrictions), and modifiers (inflation, tax, fees)

**API Endpoints** (`server/routes/projections.ts`):
- `POST /api/projections/fire` - Uses saved FIRE settings
- `POST /api/projections/fire/custom` - Uses custom FIRE configuration

**FIRE Calculator** (`shared/utils/projection-fire-calculator.ts`):
- Calculates retirement date from DOB + target retirement age
- Calculates FIRE number: `Annual Income Goal / (Safe Withdrawal Rate / 100)`
- Projects portfolio to retirement date using projection orchestrator
- Returns comprehensive `FireProjection` result

### 1.2 Frontend Architecture

**Hooks** (`client/src/hooks/use-projections.ts`):
- `useFIREProjection()` - Fetches FIRE projection using saved settings
- Takes projection config (without startDate/endDate - server adds these)
- Returns `FireProjection` with all calculated values

**Components**:
- `FireChart` - Displays age-based projection with portfolio growth, FIRE target, accessible/locked values
- `FireSettingsForm` - Form for configuring FIRE settings

**Current Page Flow**:
1. Load FIRE settings from database
2. Fetch projection using `useFIREProjection`
3. Convert server timePoints to age-based projection data
4. Display summary, chart, settings form, and investment adjustment UI

---

## 2. Critical Issues

### 2.1 Projection Configuration Issues

**Location**: `client/src/pages/fire.tsx` (lines 122-150)

**Problems**:
1. **Hardcoded growth rate**: Uses `7.0` instead of `expectedReturn` from form
2. **Preview modifier placeholder**: Hardcoded contribution scaler (`scaleFactor: 10.0`) acts as a placeholder rather than a user-driven preview control
3. **Hardcoded inflation rate**: Uses `2.8` instead of being configurable

4. **Wrong growth model**: Uses `"linear"` but should use `"compound"` for accurate projections. (This will not be modified now but leave in this document)
5. **Not reactive**: Config doesn't update when form values change

**Impact**: Projections use incorrect values, leading to inaccurate retirement predictions.

**Required Fix**:
- Use `expectedReturn` from form instead of hardcoded value
- Replace hardcoded contribution scaler with interactive preview modifiers panel
- Make inflation conditional based on `adjustInflation` form value
- Make config reactive to form changes using `useMemo`

### 2.2 Investment Adjustment Saving Immediately

**Location**: `client/src/pages/fire.tsx` (lines 257-278)

**Problem**:
- Comment says "should not modify the fire settings immediately, it should show a preview"
- But `handleAdjustInvestment` actually saves to server immediately
- No preview functionality
- No confirmation before saving

**Impact**: Poor UX, users can accidentally save unintended changes.

**Required Fix**:
- Implement true preview mode
- Update form state only (don't save)
- Add Apply/Cancel buttons
- Only save when user explicitly confirms

### 2.3 Missing Loading States

**Problem**:
- No loading indicator while projection is calculating
- No error handling for projection failures
- No feedback during long-running calculations

**Impact**: Users don't know if calculation is in progress or failed.

**Required Fix**:
- Show loading spinner during projection calculation
- Display error messages if projection fails
- Add retry mechanism
- Disable form interactions during loading

### 2.4 Missing Projection Invalidation

**Problem**:
- Projection doesn't recalculate when form values change
- React Query not properly invalidated when settings change
- Stale data shown to users

**Impact**: Users see outdated projections after changing settings.

**Required Fix**:
- Properly set up React Query dependencies
- Invalidate query when settings are saved
- Debounce rapid form changes to avoid excessive recalculations

### 2.5 State Pension Not Integrated

**Problem**:
- State pension age is calculated but not used in projection
- Not included as a contributor or shown separately

**Impact**: Missing important retirement income source in calculations.

**Required Fix**:
- Include state pension in projection (if applicable)
- Show state pension information in summary
- Allow option to include/exclude from calculations

### 2.6 Chart Always Visible

**Problem**:
- FireChart component is always displayed by default
- No option to hide/show the chart
- Takes up significant screen space

**Impact**: Poor UX, especially on mobile devices where screen space is limited.

**Required Fix**:
- Chart should be hidden by default
- Add toggle button to show/hide chart
- Toggle state should persist (localStorage) for user preference
- Smooth show/hide animation

### 2.7 Growth Mode Toggle Missing

**Problem**:
- Users cannot switch between global portfolio growth rate and contributor-specific growth rates
- Current config always uses global rate which conflicts with back-end contributor growth strategy
- No UI surface explaining which growth model applies

**Impact**: Confusing behaviour when assets with contributor growth overrides exist; difficult to run mixed scenarios (e.g. state pension vs assets).

**Required Fix**:
- Add explicit toggle for growth mode (global vs contributor-specific)
- Persist user preference in localStorage
- Update projection config to honour toggle (`useContributorSpecificGrowthRates`)
- Provide contextual help text clarifying each mode

---

## 3. Feature Enhancements

### 3.1 Enhanced Summary Display

**Current**: Basic summary showing current portfolio, FIRE number, annual income, projected retirement age

**Enhancements Needed**:
1. **Card-based snapshot** – dedicated cards for:
   - Retirement Projection Status (anticipated vs target age, variance badge)
   - Withdrawal Readiness (first accessible age, penalty notes, state pension age)
   - Portfolio Progress (current value, FIRE number, monthly shortfall)
   - Contribution Plan (intended vs preview-adjusted contributions, modifier badges)
   - Accessible vs Locked Value (current split, upcoming release milestones)
2. **Progress percentage** - Show how close user is to FIRE number
3. **Monthly/Annual shortfall** - Clearer display of shortfall amounts
4. **State pension information** - Show when state pension kicks in and amount
5. **Accessible vs locked value** - Breakdown of accessible and locked portfolio value
6. **Visual progress indicators** - Progress bar, pie chart showing progress
7. **Time to FIRE countdown** - Days/years remaining display

**UI Improvements**:
- Card-based layout for better visual organization (responsive grid with consistent headers, helper copy, and badges)
- Color coding (green for on-track, red for behind)
- Icons for visual clarity
- Responsive grid layout
- Over/under-investment indicator comparing actual portfolio contributions with preview assumptions

### 3.2 Contribution Breakdown

**Current**: Shows total monthly investment only

**Enhancements Needed**:
1. **Breakdown by account type** - Show monthly contributions per account (ISA, SIPP, LISA, GIA)
2. **Bonus impact** - Show impact of bonuses (e.g., LISA 25% bonus)
3. **Total accessible value** - Show accessible value at retirement
4. **Locked value breakdown** - Show which accounts are locked and when they become accessible
5. **Historical trends** - Show contribution trends over time

**UI Components**:
- Contribution breakdown table/cards
- Visual breakdown (pie chart or bar chart)
- Account type filters
- Bonus highlights

### 3.3 Advanced Options

**Enhancements Needed**:
1. **Growth model selector** - Allow user to choose linear vs compound
2. **State pension toggle** - Option to include/exclude state pension
3. **Inflation rate adjustment** - Not just on/off, but adjustable rate
4. **Multiple scenarios** - Compare different scenarios side-by-side
5. **Sensitivity analysis** - Show how changes in growth rate affect retirement age
6. **Withdrawal strategy preview** - Simulate safe withdrawal rates at anticipated retirement age and post-retirement stages

**UI Components**:
- Collapsible "Advanced Options" section
- Scenario comparison view
- Sensitivity analysis chart
- Export options

### 3.4 Preview Mode for Investment Adjustments

**Current**: Saves immediately when clicking +/- buttons

**Enhancements Needed**:
1. **Preview mode** - Show impact before saving
2. **Visual diff** - Highlight what would change
3. **Apply/Cancel buttons** - Explicit confirmation
4. **Multiple scenarios** - Preview multiple adjustment amounts
5. **Impact visualization** - Show years saved/lost visually

**UI Components**:
- Preview card showing projected changes
- Visual diff indicators
- Apply/Cancel action buttons
- Multiple scenario tabs

### 3.5 Standalone Contributor Preview

**Goal**: Allow users to simulate retirement projections without existing portfolio data by previewing synthetic contributors (e.g., add a Lifetime ISA with £100/month).

**Enhancements Needed**:
1. **Contribution Source Toggle** – switch between “Use my portfolio contributions” and “Custom contributors”.
2. **Synthetic Contributor Builder** – UI to add/remove simulated contributors by type (LISA, SIPP, ISA, GIA, Cash).
3. **Modifier-aware** – synthetic contributors should respect bonuses/value-release rules (e.g., LISA 25% bonus, SIPP lock until 55).
4. **Presets** – provide quick templates (e.g., “Add LISA £100/month”, “Add SIPP £200/month”).
5. **Persistence** – store the standalone setup in localStorage to support recurring standalone usage until real assets exist.

**UI Components**:
- Contribution source selector near preview modifiers
- “Add contributor” modal or inline form collecting:
  - Contribution type (account type)
  - Monthly amount
  - Optional start/end dates
- List of active preview contributors with edit/remove actions
- Badge indicating synthetic contributors in summary cards (“Preview: Custom LISA £100/mo”)
- Info callout explaining that previews are not saved to portfolio data

### 3.5 Settings Editor Access

**Current**: FIRE settings form is always visible on the page, taking significant space.

**Enhancements Needed**:
1. **Collapsible summary card** – surface current settings in a compact card with key values (income goal, SWR, monthly investment, target age).
2. **Explicit edit action** – “Edit FIRE Settings” button toggles the detailed form (inline accordion, modal, or drawer).
3. **Draft state indicator** – show badge when unsaved changes exist (“Draft changes not saved”).
4. **Contextual entry points** – summary cards link back to the editor (e.g., “Adjust income goal” opens the form).

**UI Components**:
- Summary card with quick facts and edit button
- Collapsible editor region with the existing React Hook Form
- Draft badge and helper text
- Optional timestamp for last successful save

---

## 4. UX Improvements

### 4.1 Loading States

**Implementation**:
- Skeleton loaders for summary cards
- Loading spinner overlay for chart
- Progress bar for long calculations
- Disabled state for forms during loading

### 4.2 Error Handling

**Implementation**:
- User-friendly error messages
- Retry buttons
- Fallback UI when projection fails
- Validation errors inline in form

### 4.3 Responsive Design

**Improvements**:
- Mobile-optimized layout
- Collapsible sections on mobile
- Touch-friendly buttons
- Responsive chart sizing

### 4.4 Accessibility

**Improvements**:
- ARIA labels for screen readers
- Keyboard navigation support
- Focus indicators
- High contrast mode support

### 4.5 User Guidance

**Improvements**:
- Tooltips explaining FIRE concepts
- Help text for form fields
- Guided tour for first-time users
- FAQ section
- Links to educational resources

---

## 5. Performance Optimizations

### 5.1 Debouncing

**Implementation**:
- Debounce form changes (500ms) before recalculating projection
- Cancel in-flight requests when new changes come in
- Batch multiple form updates

### 5.2 Caching

**Implementation**:
- Cache projection results with proper keys
- Invalidate cache on portfolio changes
- Use React Query cache effectively

### 5.3 Chart Performance

**Implementation**:
- Optimize chart rendering for large datasets
- Reduce data points for very long projections
- Virtual scrolling if needed
- Lazy loading of chart components

### 5.4 Code Splitting

**Implementation**:
- Lazy load FireChart component
- Code split projection utilities
- Reduce initial bundle size

---

## 6. Edge Cases & Validation

### 6.1 Missing Data Handling

**Scenarios**:
- Missing DOB → Show error, link to profile
- Missing FIRE settings → Show initial setup (already handled)
- Empty portfolio → Show message, encourage adding assets
- No recurring contributions → Show warning

### 6.2 Validation

**Scenarios**:
- Invalid form values → Show inline errors
- Unrealistic projections → Show warnings
- Negative values → Prevent/validate
- Projections beyond reasonable age (100+) → Cap or warn

### 6.3 Error Recovery

**Scenarios**:
- Network errors → Retry with exponential backoff
- Server errors → Show friendly message, contact support
- Validation errors → Highlight fields, show messages
- Timeout errors → Offer to extend timeout or simplify projection

---

## 7. Testing Requirements

### 7.1 Unit Tests

**Components**:
- FireSettingsForm validation
- Projection config generation
- Age calculation utilities
- Contribution impact calculations

### 7.2 Integration Tests

**Scenarios**:
- Full projection flow
- Form submission and save
- Investment adjustment preview
- Error handling flows

### 7.3 E2E Tests

**Scenarios**:
- User creates FIRE settings
- User adjusts investment and sees preview
- User saves settings and sees updated projection
- User views chart with different scenarios

---

## 8. Implementation Phases

### Phase 1: Critical Fixes (Week 1)

**Priority**: 🔴 Critical  
**Effort**: 3-5 days

1. **Fix projection configuration**
   - Use form values instead of hardcoded
   - Replace placeholder contribution scaler with preview modifier controls
   - Conditional inflation modifier

2. **Implement preview mode**
   - Preview without saving
   - Apply/Cancel buttons
   - Visual diff

3. **Add loading states**
   - Loading indicators
   - Disabled states during calculation

4. **Fix projection invalidation**
   - React Query dependencies
   - Debounce form changes

5. **Add chart toggle**
   - Chart hidden by default
   - Toggle button to show/hide
   - Persist preference in localStorage
   - Smooth animation

6. **Add growth mode toggle**
   - Button group to switch between global and contributor growth rates
   - Persist preference in localStorage
   - Update projection config to honour selection
   - Add helper copy to clarify behaviour

7. **Introduce settings editor card**
   - Replace always-visible form with summary card + edit toggle
   - Track dirty state and show draft messaging
   - Collapse editor by default and auto-close after save
   - Refresh summary data after edits

8. **Standalone contributor preview**
   - Add contribution source toggle (portfolio vs custom)
   - Build synthetic contributor UI for LISA/SIPP/ISA/GIA with monthly amount input
   - Store preview contributors locally; mark them clearly in summaries
   - Ensure synthetic contributors feed into projection config and respect bonuses/releases

7. **Define summary cards**
   - Retirement status card (anticipated vs target age, variance badge)
   - Withdrawal readiness card (first accessible age, penalties, state pension age)
   - Portfolio progress card (current value, FIRE number progress, shortfall)
   - Contribution plan card (planned vs preview-adjusted contributions, modifier badges)
   - Accessible vs locked value card (current split, upcoming releases)

### Phase 2: Enhanced Features (Week 2)

**Priority**: 🟡 High  
**Effort**: 5-7 days

1. **Enhanced summary display**
   - Progress indicators
   - State pension info
   - Accessible/locked breakdown
   - Withdrawal readiness messaging (penalty warnings, first accessible age)
   - Contribution plan card integration with preview modifiers and synthetic contributors

2. **Contribution breakdown**
   - Account type breakdown
   - Bonus impact visualization

3. **Error handling**
   - User-friendly errors
   - Retry mechanisms
   - Fallback UI

4. **Withdrawal strategy insights**
   - Highlight anticipated retirement age vs first withdrawal age
   - Provide safe withdrawal rate guidance (3% / 3.5% / 4% comparisons)
   - Show post-retirement withdrawal options and penalties

5. **Standalone contributor UX**
   - Contribution source toggle and custom contributor builder
   - Preset templates (e.g., add LISA £100/mo, add SIPP £200/mo)
   - Info copy clarifying preview-only nature and prompts to add real assets
   - Over/under-investment badge highlighting live contributions vs preview assumptions

### Phase 3: Advanced Features (Week 3)

**Priority**: 🟢 Medium  
**Effort**: 5-7 days

1. **Advanced options**
   - Growth model selector
   - Inflation rate adjustment
   - Scenario comparison

2. **Performance optimizations**
   - Debouncing
   - Caching
   - Chart optimization

3. **UX improvements**
   - Tooltips
   - Responsive design
   - Accessibility

### Phase 4: Polish & Testing (Week 4)

**Priority**: 🟢 Medium  
**Effort**: 3-5 days

1. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

2. **Edge case handling**
   - Missing data scenarios
   - Validation improvements
   - Error recovery

3. **Documentation**
   - User guide
   - Developer documentation
   - API documentation

---

## 9. Detailed Implementation Specifications

### 9.1 Fix Projection Configuration

**File**: `client/src/pages/fire.tsx`

**Current Code** (lines 122-170):
```typescript
const mod: ProjectionModifier = {
  type: "contribution_scaler",
  enabled: true,
  scaleFactor: 10.0,
  description: "Contribution Scaler",
};

const modifiers: ProjectionModifier[] = adjustInflation
  ? [
      {
        type: "inflation",
        enabled: true,
        rate: 2.8,
        description: "Inflation",
      },
      mod,
    ]
  : [mod];

const projectionConfig: Omit<SimpleProjectionConfig, "startDate" | "endDate"> = {
  mode: "simple",
  growthRate: 7.0,
  growthModel: "linear",
  interval: "yearly",
  modifiers,
  useContributorSpecificGrowthRates: false,
};
```

**Required Changes**:
1. Use `expectedReturn` from form instead of hardcoded 7.0
2. Replace placeholder contribution scaler with user-controlled preview modifiers
3. Make inflation preview rate configurable and optional
4. Honour growth mode toggle (`useContributorSpecificGrowthRates`)
5. Make config reactive via `useMemo`

**Updated Implementation Concept**:
```typescript
const [previewModifiersState, setPreviewModifiersState] = useState({
  contribution: { enabled: true, scaleFactor: 1.0 },
  inflation: { enabled: adjustInflation, rate: 2.8 },
});

const previewModifiers = useMemo<ProjectionModifier[]>(() => {
  const modifiers: ProjectionModifier[] = [];

  if (previewModifiersState.inflation.enabled) {
    modifiers.push({
      type: "inflation",
      enabled: true,
      rate: previewModifiersState.inflation.rate,
      description: "Inflation Preview",
    });
  }

  modifiers.push({
    type: "contribution_scaler",
    enabled: previewModifiersState.contribution.enabled,
    scaleFactor: previewModifiersState.contribution.scaleFactor,
    description: "Contribution Preview",
  });

  return modifiers;
}, [previewModifiersState]);

const projectionConfig = useMemo<Omit<SimpleProjectionConfig, "startDate" | "endDate">>(
  () => ({
    mode: "simple",
    growthRate: normalizedExpectedReturn,
    growthModel: "linear",
    interval: "yearly",
    modifiers: previewModifiers,
    useContributorSpecificGrowthRates: growthMode === "contributor",
  }),
  [normalizedExpectedReturn, previewModifiers, growthMode],
);
```

**Preview Modifiers UI Requirements**:
- Slider or numeric input for contribution multiplier (min 0, max 3.0)
- Buttons for quick presets (50%, 75%, 100%, 150%, 200%)
- Inflation toggle with numeric input (e.g., 0-10%)
- “Reset preview” button returning to default values
- Persist preview state separately from saved FIRE settings

### 9.2 Implement Preview Mode

**File**: `client/src/pages/fire.tsx`

**Current Code** (lines 257-278):
```typescript
const handleAdjustInvestment = async (adjustment: number) => {
  if (!fireSettings) return;
  const currentMonthlyInvestment = Number(watchedValues.monthlyInvestment);
  const newMonthlyInvestment = currentMonthlyInvestment + adjustment;
  
  try {
    await updateFireSettings({
      ...watchedValues,
      monthlyInvestment: createDecimalValueString(
        newMonthlyInvestment.toString()
      ),
    });
    // ...
  }
};
```

**Required Changes**:
1. Add preview state for monthly investment
2. Update preview on +/- button click, don't save
3. Add Apply/Cancel buttons
4. Show visual diff between current and preview

**New Implementation**:
```typescript
const [previewMonthlyInvestment, setPreviewMonthlyInvestment] = useState<number | null>(null);

const handlePreviewInvestment = (adjustment: number) => {
  const current = Number(watchedValues.monthlyInvestment || 0);
  const newValue = Math.max(0, current + adjustment);
  setPreviewMonthlyInvestment(newValue);
};

const handleApplyInvestment = async () => {
  if (previewMonthlyInvestment === null) return;
  // Save to server
  await updateFireSettings({
    ...watchedValues,
    monthlyInvestment: createDecimalValueString(previewMonthlyInvestment.toString()),
  });
  setPreviewMonthlyInvestment(null);
};

const handleCancelPreview = () => {
  setPreviewMonthlyInvestment(null);
};

const displayMonthlyInvestment = previewMonthlyInvestment ?? Number(watchedValues.monthlyInvestment || 0);
```

### 9.3 Add Loading States

**File**: `client/src/pages/fire.tsx`

**Required Changes**:
1. Use `isLoading` from `useFIREProjection` hook
2. Show loading skeleton/spinner
3. Disable form during loading
4. Show error state if projection fails

**Implementation**:
```typescript
const { data: currentProjection, isLoading, error } = useFIREProjection(
  projectionConfig,
  undefined
);

if (isLoading) {
  return <FirePageSkeleton />;
}

if (error) {
  return <FirePageError error={error} onRetry={refetch} />;
}
```

### 9.4 Enhanced Summary Display

**File**: `client/src/pages/fire.tsx`

**Required Components**:
1. **Retirement Status Card**
   - Anticipated retirement age vs target retirement age
   - Years ahead/behind badge with colour coding
   - Time-to-FIRE countdown and milestone timeline link
2. **Withdrawal Readiness Card**
   - First anticipated withdrawal age (state pension, LISA, SIPP thresholds)
   - Penalty warnings for early access
   - Safe withdrawal rate selector (3%, 3.5%, 4%) with projected income updates
3. **Portfolio Progress Card**
   - Current portfolio value, FIRE number, progress percentage
   - Monthly shortfall/surplus with contextual copy
   - Active preview modifiers badge (e.g. “Preview: 150% contributions”)
4. **Contribution Plan Card**
   - Planned monthly contribution vs actual (if available)
   - Preview modifier controls summary (contribution multiplier, inflation override)
   - Quick actions to open modifier panel
5. **Accessible vs Locked Value Card**
   - Accessible value today vs at target retirement age
   - Locked value schedule with upcoming release milestones
   - Link to withdrawal strategy documentation

**Implementation**:
```typescript
const progressPercentage = currentPortfolioValue > 0 && fireNumber > 0
  ? Math.min(100, (currentPortfolioValue / fireNumber) * 100)
  : 0;

const accessibleValueAtRetirement = projectionResult?.timePoints
  ?.find(p => p.date >= projectedRetirementDate)?.
  accessibleValue;

const lockedValueAtRetirement = projectionResult?.timePoints
  ?.find(p => p.date >= projectedRetirementDate)?.
  lockedValue;
```

**Layout Guidelines**:
- Two-column grid on desktop, stacked cards on mobile
- Consistent card headers with iconography and helper copy
- Inline badges for status (“On Track”, “Behind”, “Preview Active”, “Penalty Risk”)
- Tooltip or info icon explaining each metric
- Footer CTA per card (e.g., “Adjust Preview”, “View Withdrawal Options”, “Open Contribution Settings”)

### 9.5 Add Chart Toggle

**File**: `client/src/pages/fire.tsx`

**Required Changes**:
1. Add state for chart visibility (default: false)
2. Persist state in localStorage
3. Add toggle button above chart area
4. Conditionally render chart based on state
5. Smooth show/hide animation

**Implementation**:
```typescript
const [showChart, setShowChart] = useState(() => {
  const saved = localStorage.getItem('fire-chart-visible');
  return saved === 'true';
});

const handleToggleChart = () => {
  const newValue = !showChart;
  setShowChart(newValue);
  localStorage.setItem('fire-chart-visible', String(newValue));
};

// In JSX - add toggle button:
<Button
  variant="outline"
  onClick={handleToggleChart}
  className="mb-4"
>
  {showChart ? 'Hide Chart' : 'Show Chart'}
</Button>

// Conditionally render chart:
{showChart && (
  <FireChart
    projectionData={fireProjectionData}
    yearsToFire={yearsToFire}
    config={fireConfig}
    targetRetirementAge={targetRetirementAge}
    projectedRetirementAge={calculatedProjectedRetirementAge}
    className="mb-6"
  />
)}
```

---

### 9.6 Add Growth Mode Toggle

**File**: `client/src/pages/fire.tsx`

**Required Changes**:
1. Local state for growth mode (`"global"` | `"contributor"`)
2. Load/save preference from `localStorage`
3. Update projection config with `useContributorSpecificGrowthRates`
4. Add toggle UI with helper copy

**Implementation**:
```typescript
const [growthMode, setGrowthMode] = useState<"global" | "contributor">("global");

useEffect(() => {
  const saved = localStorage.getItem("fire-growth-mode");
  if (saved === "global" || saved === "contributor") {
    setGrowthMode(saved);
  }
}, []);

useEffect(() => {
  localStorage.setItem("fire-growth-mode", growthMode);
}, [growthMode]);

const useContributorGrowthRates = growthMode === "contributor";

const projectionConfig = useMemo(() => ({
  mode: "simple",
  growthRate: normalizedReturn,
  growthModel: "linear",
  interval: "yearly",
  modifiers,
  useContributorSpecificGrowthRates: useContributorGrowthRates,
}), [normalizedReturn, modifiers, useContributorGrowthRates]);

// UI
<div className="flex bg-white shadow-sm rounded-md p-1">
  <Button
    variant={growthMode === "global" ? "default" : "ghost"}
    size="sm"
    onClick={() => setGrowthMode("global")}
  >
    Global Rate
  </Button>
  <Button
    variant={growthMode === "contributor" ? "default" : "ghost"}
    size="sm"
    onClick={() => setGrowthMode("contributor")}
  >
    Contributor Rates
  </Button>
</div>
```

---

### 9.7 Preview Modifier Controls

**File**: `client/src/pages/fire.tsx` (integration), `client/src/components/fire/PreviewModifiersPanel.tsx` (new)

**Objective**: Provide a “What-if Modifiers” panel that applies temporary `ProjectionModifier`s so users can explore scenarios without altering saved settings.

**Key Features**:
- **Contribution Multiplier**: Slider with preset buttons (50%, 75%, 100%, 150%, 200%)
- **Inflation Override**: Toggle + numeric input to simulate different inflation rates
- **Scenario Presets**: (Future) Chips like “Aggressive Savings” (150% contributions, lower inflation) or “Cost Pressures” (100% contributions, higher inflation)
- **State Persistence**: Store preview state in local component state and optional localStorage for continuity
- **Clear Status Messaging**: Display badge or note in summary indicating preview modifiers are applied

**Implementation Sketch**:
```tsx
const PreviewModifiersPanel = ({
  value,
  onChange,
}: {
  value: PreviewModifiersState;
  onChange: (next: PreviewModifiersState) => void;
}) => {
  return (
    <Card className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Preview Modifiers</h3>
          <p className="text-sm text-muted-foreground">
            Adjust contributions and inflation to explore what-if scenarios. These changes are not saved.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(defaultPreviewState)}>
          Reset
        </Button>
      </header>

      <ContributionMultiplierControl
        value={value.contribution}
        onChange={(contribution) => onChange({ ...value, contribution })}
      />

      <InflationPreviewControl
        value={value.inflation}
        onChange={(inflation) => onChange({ ...value, inflation })}
      />
    </Card>
  );
};
```

**Towards Future Modifiers**:
- Tax preview, fee preview, contribution pauses, lump-sum injections
- Allow stacking multiple modifiers but clearly label them
- Eventually reuse panel for portfolio and milestone views

---

### 9.8 Portfolio Contribution vs Preview Indicator

**File**: `client/src/pages/fire.tsx` (summary cards), `client/src/components/fire/ContributionPlanCard.tsx` (new)

**Objective**: Surface whether a user’s actual recurring contributions (from assets) are over- or under-investing relative to the current preview assumptions (portfolio vs custom synthetic contributors).

**Key Features**:
- Calculate monthly totals from portfolio contributors returned in `computationContext.contributors`.
- Compare against preview contribution amount (custom slider or synthetic contributors) and highlight variance.
- Display badge in contribution plan card:
  - `On Track` (within ±5%)
  - `Over-investing by £X/month`
  - `Under-investing by £X/month`
- Provide contextual copy and a link to open the settings editor or preview modifiers panel to reconcile differences.
- When no real contributors exist, indicate “Using preview-only contributions”.

**Implementation Sketch**:
```tsx
const portfolioContributionTotal = useMemo(() =>
  sumContributorSchedules(contributorsForFire),
[contributorsForFire]);

const previewContributionTotal = getPreviewContributionTotal(
  useContributorGrowthRates,
  syntheticContributors,
  previewModifiersState,
);

const contributionDelta = previewContributionTotal - portfolioContributionTotal;

const investmentStatus = computeInvestmentStatus(contributionDelta);
```

**UI Elements**:
- Status badge (`variant="success" | "warning" | "destructive"`) depending on delta.
- Subtext summarising actual vs preview amounts.
- CTA buttons: “Adjust Preview” (opens modifiers) and “Edit Contributions” (navigates to asset contribution management).
- Tooltip explaining calculation methodology.

---

### 9.9 Unified Projection State Model

**File**: `client/src/hooks/use-fire-projection-state.ts`, `client/src/hooks/use-fire-server-projection.ts`, `client/src/hooks/use-fire-preview-projection.ts`

**Objective**: Ensure the server projection response and any preview projection share an identical schema so downstream components render the same contract regardless of source.

**Key Decisions**:
- Fetch server projection once on page load (and re-fetch only when persistent FIRE settings change).
- Treat the `useFIREProjection` result as the authoritative baseline; expose it as a `FireProjectionView` object `{ ...FireProjection, state: "current" }`.
- Derive preview projections locally using the projection client, cloning the baseline response, applying modifiers/synthetic contributors, and returning `{ ...FireProjection, state: "preview" }`.
- Subcomponents consume a unified projection object; they do not care whether it is server or preview beyond optional badges.
- Maintain a clear separation between persistent settings (server) and transient preview modifiers.

**Implementation Sketch**:
```ts
type FireProjectionView = FireProjection & {
  state: "current" | "preview";
  appliedModifiers?: ProjectionModifier[];
  syntheticContributors?: Contributor[];
};

const currentProjection = useFireServerProjection({ ...config });
const previewProjection = useFirePreviewProjection({
  base: currentProjection,
  modifiers: previewModifiers,
  syntheticContributors,
});
```

**Benefits**:
- Simplifies component contracts (cards, chart, summary badges)
- Enables easy comparison between current plan and preview scenario
- Reduces state duplication and confusion between server vs preview data flows

---

### 9.10 FIRE Settings Editor Card

**File**: `client/src/pages/fire.tsx` (integration), `client/src/components/fire/FireSettingsSummaryCard.tsx` (new)

**Objective**: Present current FIRE settings in a compact summary card with an explicit action to open the full editor, replacing the always-visible form.

**Key Features**:
- Summary card showing annual income goal, safe withdrawal rate, monthly investment, target retirement age, and optional last updated timestamp.
- “Edit Settings” button to expand the full form (inline collapsible section, modal, or drawer).
- Unsaved draft badge when the form is dirty.
- Auto-collapse editor after successful save and refresh summary card values.
- Contextual links from summary cards (e.g., contribution plan card) to open the editor.

**Implementation Sketch**:
```tsx
const [isEditorOpen, setIsEditorOpen] = useState(false);
const [hasDraft, setHasDraft] = useState(false);

return (
  <Card>
    <CardHeader className="flex items-center justify-between">
      <div>
        <CardTitle>FIRE Settings</CardTitle>
        <CardDescription>These values power your projections.</CardDescription>
      </div>
      {hasDraft && <Badge variant="warning">Draft changes</Badge>}
    </CardHeader>
    <CardContent>
      <SettingsSummaryGrid settings={fireSettings} />
      <div className="mt-4 flex gap-2">
        <Button onClick={() => setIsEditorOpen((prev) => !prev)}>
          {isEditorOpen ? "Close Editor" : "Edit Settings"}
        </Button>
        <Button variant="ghost" onClick={handlePreviewModifierOpen}>
          Adjust Preview
        </Button>
      </div>
      <Collapsible open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <FireSettingsForm
          onDirtyChange={setHasDraft}
          onSubmitted={() => {
            setHasDraft(false);
            setIsEditorOpen(false);
            refetchFireSettings();
          }}
        />
      </Collapsible>
    </CardContent>
  </Card>
);
```

**Considerations**:
- Use `formState.isDirty` to toggle the draft badge.
- Manage focus when opening/closing editor for accessibility.
- Expose callbacks so summary cards can trigger editor opening for specific fields (e.g., via React Context or refs).

---

## 10. Acceptance Criteria

### 10.1 Critical Fixes

- [ ] Projection uses form values (expectedReturn, adjustInflation) instead of hardcoded
- [ ] No test contribution scaler in modifiers
- [ ] Preview mode works without saving immediately
- [ ] Apply/Cancel buttons functional
- [ ] Loading states show during calculation
- [ ] Error states display with retry option
- [ ] Projection recalculates when form values change
- [ ] Chart is hidden by default with toggle to show/hide
- [ ] Chart toggle preference persists in localStorage
- [ ] Growth mode toggle switches between global and contributor-specific rates
- [ ] Growth mode preference persists in localStorage
- [ ] Preview modifiers panel allows contribution and inflation adjustments without persisting settings
- [ ] Summary cards surface retirement status, withdrawal readiness, portfolio progress, contribution plan, and accessibility information in separate cards
- [ ] Withdrawal readiness card highlights first accessible age, penalty risk, and safe withdrawal rate options
- [ ] FIRE settings summary card replaces always-visible form with collapsible editor and draft indicator
- [ ] Standalone contributor preview supports adding synthetic LISA/SIPP/ISA/GIA contributors with custom amounts
- [ ] Contribution plan card displays over/under-investment badge comparing live contributions against preview assumptions
- [ ] Server and preview projections expose identical view models so components render them interchangeably

### 10.2 Enhanced Features

- [ ] Progress percentage displayed
- [ ] State pension information shown
- [ ] Accessible/locked value breakdown visible
- [ ] Contribution breakdown by account type
- [ ] Bonus impact visualized
- [ ] Error handling with user-friendly messages

### 10.3 Advanced Features

- [ ] Growth model selector works
- [ ] Inflation rate adjustable
- [ ] Scenario comparison functional
- [ ] Performance optimizations implemented
- [ ] Responsive design works on mobile

### 10.4 Quality

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] No console errors
- [ ] Accessibility standards met
- [ ] Performance benchmarks met

---

## 11. Dependencies & Prerequisites

### 11.1 Backend Dependencies

- Projection service must return `computationContext` with contributors
- FIRE settings API must be functional
- Portfolio overview API must be functional

### 11.2 Frontend Dependencies

- React Query must be configured
- Form validation schemas must be complete
- Chart components must support required props
- UI components must be available

### 11.3 Data Requirements

- User must have DOB in profile
- User must have assets in portfolio (optional but recommended)
- FIRE settings must be saved (required for projection)

---

## 12. Risk Assessment

### 12.1 Technical Risks

**Risk**: Performance issues with large projections  
**Mitigation**: Implement debouncing, caching, and data point reduction

**Risk**: Complex state management  
**Mitigation**: Use React Query for server state, local state for UI

**Risk**: Backend API changes  
**Mitigation**: Type safety with Zod schemas, version API endpoints

### 12.2 UX Risks

**Risk**: Confusing preview vs save behavior  
**Mitigation**: Clear UI indicators, tooltips, confirmation dialogs

**Risk**: Long calculation times  
**Mitigation**: Loading states, progress indicators, background processing

**Risk**: Missing data scenarios  
**Mitigation**: Clear error messages, guidance, fallback UI

---

## 13. Success Metrics

### 13.1 Performance Metrics

- Projection calculation time < 2 seconds
- Page load time < 1 second
- Chart render time < 500ms
- Form interaction response < 100ms

### 13.2 UX Metrics

- User completes FIRE setup in < 5 minutes
- Error rate < 1%
- User satisfaction score > 4/5
- Feature adoption rate > 60%

### 13.3 Business Metrics

- Increased engagement with FIRE planning
- Higher retention for users with FIRE settings
- Increased portfolio value tracking
- More accurate retirement planning

---

## 14. Future Enhancements (Out of Scope)

### 14.1 Advanced Features

- Monte Carlo simulations
- Tax optimization strategies
- Multiple retirement scenarios
- Integration with external financial tools
- AI-powered recommendations

### 14.2 Social Features

- Share FIRE progress
- Compare with peers (anonymized)
- Community challenges
- Expert advice integration

### 14.3 Mobile App

- Native mobile app
- Push notifications for milestones
- Offline mode
- Widget support

---

## 15. Conclusion

This development plan addresses critical fixes, enhanced features, and quality improvements for the FIRE page. Prioritize Phase 1 to stabilize the page, then move to Phase 2 for user value. Phases 3 and 4 add polish and robustness.

Implementation should follow the existing codebase patterns, use TypeScript for type safety, and maintain consistency with the rest of the application.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Author**: Development Team  
**Status**: Ready for Review

