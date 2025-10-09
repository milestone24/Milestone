# Future Value Projection System

## Overview

Add a comprehensive future value projection system that can predict asset values for future dates using either simple growth models or advanced historical analysis. The system will support configurable modifiers, work with both manual and calculated assets, leverage DB-level optimizations for performance, and integrate milestone/FIRE tracking to predict if users are on target for their goals.

## Phase 1: Core Types & Schemas

### 1.1 Shared Projection Types (`shared/schema/projections.ts`) ✅

Create Zod schemas and TypeScript types for:

- **ProjectionMode**: `'simple' | 'advanced'`
- **GrowthModel**: `'linear' | 'compound'`
- **ProjectionModifier**: Tax deductors, inflation incrementors, contribution adjustments
- **ProjectionConfig**: User-configurable parameters including:
  - Mode selection
  - Growth rate (simple mode)
  - Historical period for averages (advanced mode)
  - Enabled modifiers with values
  - Growth model preference
- **ProjectionResult**: Output schema with projected values, breakdown by asset, applied modifiers
- **ProjectionTimePoint**: Similar to `AssetValueTimePoint` but for projected values
- **MilestoneTarget**: Milestone configuration for tracking progress
- **MilestoneProgress**: Result showing if user is on track for milestone
- **FIREProjectionConfig**: FIRE-specific configuration with retirement age calculations
- **FIREProgress**: Retirement feasibility and timeline results

### 1.2 Database Schema Considerations

Document (in comments/docs) potential future tables:

- `projected_values_cache` (TTL-based temporary storage)
- `projection_configurations` (saved user preferences)
- Milestone enhancements: Add `target_date` field or asset relationship junction table
- Note: Initial implementation will be calculation-only

## Phase 2: Core Projection Engine

### 2.1 Simple Projection Service (`server/services/projections/simple.ts`)

Implement simple projection logic:

- **Input**: Current value, recurring contributions, growth rate, date range
- **Methods**:
  - `projectWithLinearGrowth()`: Apply flat rate growth only to initial value
  - `projectWithCompoundGrowth()`: Compound growth on accumulated value
  - `applyRecurringContributions()`: Project future contribution schedule using existing `getNextExecutionDate` utilities
  - `generateProjectionTimeSeries()`: Create day-by-day or interval-based projections

### 2.2 Advanced Projection Service (`server/services/projections/advanced.ts`)

Implement historical analysis-based projections:

- **Methods**:
  - `calculateHistoricalGrowthRate()`: Analyze past `assetValues` for growth patterns
    - For calculated assets: Use security price CAGR
    - For manual assets: Use asset value history
  - `calculateVolatilityMetrics()`: Standard deviation for confidence ranges (future enhancement)
  - `projectWithHistoricalGrowth()`: Apply calculated historical rates
  - `blendGrowthRates()`: Combine historical with user-anticipated rates

### 2.3 Modifier System (`server/services/projections/modifiers.ts`)

Create pluggable modifier architecture:

```typescript
interface ProjectionModifier {
  name: string;
  enabled: boolean;
  apply(value: number, date: Date, context: ModifierContext): number;
}
```

Implement modifiers:

- **TaxDeductorModifier**: Reduce contributions by tax rate
- **InflationAdjusterModifier**: Adjust values for inflation over time
- **ContributionScalerModifier**: Scale recurring contributions by percentage
- **FeeModifier**: Deduct management fees from growth
- **ModifierChain**: Compose multiple modifiers

### 2.4 Projection Orchestrator (`server/services/projections/orchestrator.ts`)

Main coordination service:

- Route to simple or advanced projection based on config
- Apply modifier chain
- Handle single asset vs. portfolio projections
- Aggregate results across multiple assets
- Generate time-series data points
- Coordinate with milestone and FIRE calculators

## Phase 3: Milestone & FIRE Integration

### 3.1 Milestone Progress Tracking (`server/services/projections/milestone-tracker.ts`)

Implement milestone target analysis:

- **Methods**:
  - `checkMilestoneProgress()`: Compare projected values against milestone targets
  - `calculateShortfall()`: Determine gap between projection and target
  - `recommendContributionAdjustment()`: Calculate additional contributions needed
  - `filterAssetsByMilestone()`: Select assets based on milestone accountType filter
- **Milestone Relationships**:
  - One-to-many: Single milestone can track multiple assets
  - Filter by accountType (ISA, SIPP, LISA, GIA) or null for portfolio-wide
  - Current schema supports this via accountType field
- **Output**: `MilestoneProgress` with isOnTrack, shortfall, projected vs target values

### 3.2 FIRE Projection Calculator (`server/services/projections/fire-calculator.ts`)

Implement FIRE-specific calculations treating FIRE as a special milestone:

- **Methods**:
  - `calculateRetirementDate()`: From user DOB + targetRetirementAge
  - `calculateFIRENumber()`: Required portfolio value (annualIncome / withdrawalRate * 100)
  - `projectToRetirement()`: Run projection from today to calculated retirement date
  - `checkFIREFeasibility()`: Determine if user can retire on schedule
  - `calculateMonthlyShortfall()`: Additional contributions needed if behind
- **Integration**: 
  - Uses existing fireSettings table (targetRetirementAge, annualIncomeGoal, etc.)
  - Reads user DOB from profile
  - Returns `FIREProgress` with retirement date, projected value, on-track status
- **Key Difference from Regular Milestone**: End date is calculated, not user-specified

## Phase 4: Database-Level Optimizations

### 4.1 Historical Data Queries (`server/services/projections/queries.ts`)

Create optimized DB queries:

- **Window functions** for historical growth calculations:
  ```sql
  -- Calculate period-over-period growth rates
  WITH growth_rates AS (
    SELECT 
      value_date,
      value,
      LAG(value) OVER (ORDER BY value_date) as prev_value,
      (value - LAG(value) OVER (ORDER BY value_date)) / 
        LAG(value) OVER (ORDER BY value_date) as growth_rate
    FROM asset_values
    WHERE asset_id = $1 AND value_date >= $2
  )
  SELECT AVG(growth_rate), STDDEV(growth_rate) FROM growth_rates;
  ```

- **CTEs** for combining asset and transaction history for baseline calculations
- **Efficient date range filtering** using existing indexes

### 4.2 Performance Optimization Notes

Document future enhancements:

- **Materialized View**: `mv_asset_growth_metrics` - Pre-calculated growth rates refreshed daily
- **Stored Procedure**: `calculate_projection_baseline()` - Move heavy calculation to DB
- **Partial Indexes**: On `asset_values.value_date` for recent data
- Use existing streaming patterns from `assets.ts` for memory efficiency

## Phase 5: API Layer

### 5.1 Projection Routes (`server/routes/projections.ts`)

Create new API endpoints:

- `POST /api/projections/asset/:assetId` - Single asset projection
- `POST /api/projections/portfolio` - Full portfolio projection
- `POST /api/projections/assets` - Multiple specific assets
- `POST /api/projections/milestone/:milestoneId` - Milestone-specific projection
- `POST /api/projections/fire` - FIRE retirement projection
- Request body: ProjectionConfig (with optional milestoneTarget or fireConfig)
- Response: ProjectionResult with time-series data + milestone/FIRE progress

### 5.2 Validation & Error Handling

- Validate date ranges (can be past or future per requirement 5)
- Ensure growth rates are reasonable (-100% to +1000%)
- Handle missing historical data gracefully
- Return partial results with warnings if some assets fail

## Phase 6: WebSocket Integration

### 6.1 Long-Running Projection Support (`server/services/projections/websocket.ts`)

Leverage existing websocket infrastructure:

- Send progress updates for complex portfolio projections
- Stream projection data points as they're calculated
- Allow cancellation of in-progress projections
- Use existing `SocketMessage` types with new projection-specific subtypes

## Phase 7: Client Integration

### 7.1 Hooks (`client/src/hooks/use-projections.ts`)

Create custom hooks:

- `useAssetProjection()` - Single asset projection query
- `usePortfolioProjection()` - Portfolio-wide projection
- `useMilestoneProjection()` - Milestone-specific projection with progress tracking
- `useFIREProjection()` - FIRE retirement projection
- Handle loading states, caching with React Query
- Invalidation when underlying asset data changes

### 7.2 Projection Configuration Component (`client/src/components/projections/ProjectionConfig.tsx`)

UI for configuring projections:

- Mode selector (Simple/Advanced)
- Growth rate input (simple mode)
- Historical period selector (advanced mode)
- Growth model toggle (Linear/Compound)
- Modifier toggles and value inputs
- Date range selector (from/to dates)

### 7.3 Projection Visualization (`client/src/components/projections/ProjectionChart.tsx`)

Chart component showing:

- Historical values (existing data)
- Projected values (dashed line)
- Confidence bands (future enhancement)
- Breakdown by asset (stacked area chart)
- Modifier impact visualization

### 7.4 Milestone Progress Component (`client/src/components/projections/MilestoneProgress.tsx`)

Display milestone tracking results:

- Current vs target values
- On-track indicator (green/amber/red)
- Projected achievement date
- Recommended contribution adjustments
- Visual progress bar

### 7.5 FIRE Progress Component (`client/src/components/projections/FIREProgress.tsx`)

Display FIRE retirement analysis:

- Retirement date (target vs projected)
- Years ahead/behind schedule
- FIRE number vs projected portfolio value
- Monthly shortfall if behind
- Integration with existing FIRE page

### 7.6 New Projection Chart Component

Create a new `ProjectionValuesChart.tsx` that replicates `ValuesChart.tsx` behavior:

- Replicate existing chart functionality from ValuesChart
- Add projection data as separate series
- Visual distinction (dashed/dotted lines for projections)
- Hover tooltips showing calculation details and projection breakdown
- Note: Consider merging with ValuesChart later if patterns prove successful

## Phase 8: Testing Strategy

### 8.1 Unit Tests

- Projection calculation accuracy (simple & advanced)
- Modifier application correctness
- Edge cases (negative growth, zero contributions)
- Historical data analysis accuracy
- Milestone progress tracking accuracy
- FIRE retirement date calculations

### 8.2 Integration Tests

- Full projection flow from API to response
- Multi-asset aggregation
- WebSocket streaming
- Milestone and FIRE projections end-to-end

## Phase 9: Documentation & Future Enhancements

### 9.1 Documentation

Create `docs/Projections.md`:

- Projection modes explained
- Growth model differences
- Modifier usage examples
- Milestone and FIRE integration guide
- API reference
- Performance considerations

### 9.2 Future Optimization Opportunities

Document for future sprints:

- **Materialized Views**: Pre-aggregate historical metrics
- **Database Functions**: Move complex calculations to PostgreSQL
- **Caching Layer**: Redis for frequently-requested projections
- **Batch Processing**: Pre-calculate common scenarios overnight
- **ML Enhancement**: Use actual ML models for advanced projections
- **Scenario Comparison**: Allow saving/comparing multiple projection scenarios
- **Milestone Enhancements**: Add target_date field and asset relationships to database

## Key Files to Create/Modify

### New Files:

- `shared/schema/projections.ts` - Types and schemas ✅
- `server/services/projections/orchestrator.ts` - Main service
- `server/services/projections/simple.ts` - Simple mode logic
- `server/services/projections/advanced.ts` - Advanced mode logic
- `server/services/projections/modifiers.ts` - Modifier system
- `server/services/projections/milestone-tracker.ts` - Milestone progress tracking
- `server/services/projections/fire-calculator.ts` - FIRE retirement calculations
- `server/services/projections/queries.ts` - Optimized DB queries
- `server/services/projections/websocket.ts` - WS integration
- `server/routes/projections.ts` - API routes
- `client/src/hooks/use-projections.ts` - Client hooks
- `client/src/components/projections/` - Projection UI components
- `client/src/components/projections/MilestoneProgress.tsx` - Milestone tracking UI
- `client/src/components/projections/FIREProgress.tsx` - FIRE progress UI
- `client/src/components/charts/ProjectionValuesChart.tsx` - New chart component replicating ValuesChart with projection support
- `docs/Projections.md` - Documentation

### Modified Files:

- `server/index.ts` - Register projection routes
- `shared/api/queryKeys.ts` - Add projection query keys
- `server/db/schema/portfolio-assets.ts` - Add comments for future schema additions

## Implementation Notes

1. **Leverage Existing Patterns**: Use streaming generators from `assets.ts`, window functions from `getCombinedAssetTransactionsWithBoundariesForAsset()`
2. **Cache Strategy**: Implement simple in-memory Map cache with TTL (10-15 minutes)
3. **Date Handling**: Support both historical "what-if" and future projections
4. **Security**: Ensure user can only project their own assets (use existing auth middleware)
5. **Performance**: For portfolio projections with many assets, consider parallel processing
6. **Modifiers**: Design as composable chain for flexibility
7. **Milestone Integration**: Current milestone table supports accountType filtering for one-to-many asset relationships
8. **FIRE Integration**: Calculate retirement date from user DOB + target age, treat as special milestone with calculated end date

### To-dos

- [x] Create projection schemas and TypeScript types in shared/schema/projections.ts
- [ ] Implement simple projection service with linear and compound growth models
- [ ] Implement advanced projection service with historical analysis
- [ ] Create pluggable modifier system for tax, inflation, and contribution adjustments
- [ ] Build projection orchestrator to coordinate modes and modifiers
- [ ] Implement milestone progress tracking service
- [ ] Implement FIRE retirement projection calculator
- [ ] Create optimized database queries using window functions and CTEs
- [ ] Implement API routes for single asset and portfolio projections
- [ ] Add milestone and FIRE projection API endpoints
- [ ] Add WebSocket support for long-running portfolio projections
- [ ] Create React hooks for projection data fetching and caching
- [ ] Build projection configuration and visualization components
- [ ] Create milestone progress UI component
- [ ] Create FIRE progress UI component
- [ ] Create new ProjectionValuesChart component replicating ValuesChart behavior with projection support
- [ ] Write unit and integration tests for projection calculations
- [ ] Create comprehensive documentation with API reference and examples
