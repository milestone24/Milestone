# Future Value Projections API

## Overview

The Future Value Projections system allows users to predict where their investment portfolio values might be at a future date. It supports two projection modes (simple and advanced), configurable modifiers (tax, inflation, fees, contribution scaling), and integrates with milestone tracking and FIRE retirement planning.

**Key Features:**
- Project individual assets or entire portfolios
- Simple mode: User-provided growth rates
- Advanced mode: Historical data analysis with CAGR calculations
- Configurable modifiers for realistic projections
- Milestone progress tracking (one-to-many asset relationships)
- FIRE retirement feasibility analysis
- Support for both future and historical "what-if" scenarios

## Table of Contents

- [Projection Modes](#projection-modes)
- [Growth Models](#growth-models)
- [Modifiers](#modifiers)
- [API Endpoints](#api-endpoints)
- [Request Examples](#request-examples)
- [Response Examples](#response-examples)
- [Integration Guides](#integration-guides)

## Projection Modes

### Simple Mode

Uses a user-provided growth rate to project future values.

**When to use:**
- Quick projections with estimated growth rates
- Conservative or optimistic scenarios
- When historical data is insufficient

**Configuration:**
```typescript
{
  mode: "simple",
  growthModel: "linear" | "compound",
  growthRate: 7.0, // Annual percentage (e.g., 7% = 7.0)
  startDate: "2025-01-01",
  endDate: "2030-01-01",
  interval: "monthly",
  modifiers: []
}
```

### Advanced Mode

Analyzes historical asset/security data to calculate growth rates automatically.

**When to use:**
- Assets with substantial historical data (3+ months recommended)
- Data-driven projections
- Blending historical trends with anticipated changes

**Configuration:**
```typescript
{
  mode: "advanced",
  growthModel: "compound",
  historicalPeriodMonths: 36, // Analyze last 36 months
  anticipatedGrowthRate: 8.0, // Optional: blend with historical
  blendRatio: 0.5, // 0 = all historical, 1 = all anticipated
  startDate: "2025-01-01",
  endDate: "2030-01-01",
  interval: "monthly",
  modifiers: []
}
```

**How it works:**
- **Calculated assets (securities)**: Analyzes security price CAGR from `securityDailyHistory`
- **Manual assets**: Analyzes asset value history from `assetValues` table
- **Blending**: Combines historical rate with user's anticipated rate using blend ratio

## Growth Models

### Linear Growth

Growth is applied only to the initial principal value.

**Formula:** `FV = PV + (PV × rate × years)`

**Example:**
- Initial: £10,000
- Growth: 7% annually
- After 5 years: £10,000 + (£10,000 × 0.07 × 5) = £13,500

**Use case:** Conservative projections, understanding baseline growth

### Compound Growth

Growth is applied to the accumulated value (principal + previous growth + contributions).

**Formula:** `FV = PV × (1 + rate)^years`

**Example:**
- Initial: £10,000
- Growth: 7% annually compounded
- After 5 years: £10,000 × (1.07)^5 = £14,025.52

**Use case:** More realistic investment projections, accounts for compounding effect

## Modifiers

Modifiers are applied in the order they're defined in the array. All modifiers can be enabled/disabled.

### Tax Deductor

Reduces contributions by tax rate (post-tax investing).

```typescript
{
  type: "tax",
  enabled: true,
  rate: 20, // 20% tax rate
  description: "UK basic rate tax"
}
```

**Effect:** £1,000 contribution becomes £800 invested

### Inflation Adjuster

Adjusts projected values to account for inflation over time.

```typescript
{
  type: "inflation",
  enabled: true,
  rate: 2.5, // 2.5% annual inflation
  description: "UK inflation target"
}
```

**Effect:** Reduces real purchasing power of future values

### Contribution Scaler

Scales recurring contributions by a factor for "what-if" scenarios.

```typescript
{
  type: "contribution_scaler",
  enabled: true,
  scaleFactor: 1.2, // 20% increase (1.0 = no change, 0.5 = 50% reduction)
  description: "What if I increase contributions by 20%?"
}
```

**Effect:** £500/month becomes £600/month

### Fee Deductor

Deducts management fees from portfolio growth.

```typescript
{
  type: "fee",
  enabled: true,
  annualRate: 0.75, // 0.75% annual fee
  description: "Fund management fee"
}
```

**Effect:** Reduces net returns by fee percentage annually

## API Endpoints

### 1. Single Asset Projection

**Endpoint:** `POST /api/projections/asset/:assetId`

**Description:** Project future value of a single investment asset

**Authentication:** Required (Bearer token or session cookie)

**Request Body:**
```typescript
{
  config: ProjectionConfig,
  milestoneTarget?: MilestoneTarget // Optional
}
```

**Response:**
```typescript
{
  config: ProjectionConfig,
  totalCurrentValue: number,
  totalProjectedValue: number,
  totalGrowth: number,
  totalContributions: number,
  timePoints: ProjectionTimePoint[],
  assetBreakdown: AssetProjection[],
  milestoneProgress?: MilestoneProgress[],
  calculatedAt: Date,
  warnings?: string[]
}
```

### 2. Portfolio Projection

**Endpoint:** `POST /api/projections/portfolio`

**Description:** Project future value of entire portfolio or filtered assets

**Authentication:** Required

**Request Body:**
```typescript
{
  config: ProjectionConfig,
  accountTypeFilter?: string | null, // Filter by ISA, SIPP, etc.
  assetIds?: string[], // Specific assets, or omit for all
  milestoneTarget?: MilestoneTarget,
  fireConfig?: FIREProjectionConfig
}
```

**Response:** Same as single asset projection, with optional `fireProgress` field

### 3. Milestone Progress

**Endpoint:** `POST /api/projections/milestone/:milestoneId`

**Description:** Check if user is on track for a specific milestone

**Authentication:** Required

**Request Body:**
```typescript
{
  config: ProjectionConfig
}
```

**Response:**
```typescript
{
  milestoneId: string,
  milestoneName: string,
  targetValue: number,
  targetDate?: Date,
  projectedValueAtTarget: number,
  isOnTrack: boolean,
  shortfall: number, // Negative if ahead, positive if behind
  shortfallPercentage: number
}
```

### 4. All Milestones Progress

**Endpoint:** `POST /api/projections/milestones`

**Description:** Check progress for all user milestones

**Authentication:** Required

**Request Body:**
```typescript
{
  config: ProjectionConfig
}
```

**Response:** `MilestoneProgress[]`

### 5. FIRE Retirement Projection

**Endpoint:** `POST /api/projections/fire`

**Description:** Project FIRE retirement feasibility using saved FIRE settings

**Authentication:** Required

**Request Body:**
```typescript
{
  config: Omit<ProjectionConfig, "startDate" | "endDate">
  // startDate/endDate are calculated from user's DOB and target retirement age
}
```

**Response:**
```typescript
{
  fireNumber: number, // Required portfolio value to retire
  projectedRetirementDate: Date,
  projectedRetirementAge: number,
  targetRetirementAge: number,
  projectedValueAtRetirement: number,
  isOnTrack: boolean,
  yearsAheadOrBehind: number, // Negative if ahead
  monthlyShortfall?: number // Additional monthly contribution needed if behind
}
```

### 6. Custom FIRE Projection

**Endpoint:** `POST /api/projections/fire/custom`

**Description:** Project FIRE with custom parameters (not using saved settings)

**Authentication:** Required

**Request Body:**
```typescript
{
  config: Omit<ProjectionConfig, "startDate" | "endDate">,
  fireConfig: {
    dateOfBirth: Date,
    targetRetirementAge: number,
    annualIncomeGoal: number,
    safeWithdrawalRate: number,
    adjustForInflation: boolean,
    statePensionAge: number
  }
}
```

**Response:** Same as FIRE endpoint

## Request Examples

### Example 1: Simple Portfolio Projection

Project entire portfolio with 7% compound growth for next 5 years:

```bash
curl -X POST https://your-app.com/api/projections/portfolio \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {
      "mode": "simple",
      "growthModel": "compound",
      "growthRate": 7.0,
      "startDate": "2025-01-01",
      "endDate": "2030-01-01",
      "interval": "monthly",
      "modifiers": []
    }
  }'
```

### Example 2: Advanced Asset Projection with Modifiers

Project a single ISA with historical analysis and modifiers:

```bash
curl -X POST https://your-app.com/api/projections/asset/abc-123-def \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {
      "mode": "advanced",
      "growthModel": "compound",
      "historicalPeriodMonths": 36,
      "anticipatedGrowthRate": 8.0,
      "blendRatio": 0.7,
      "startDate": "2025-01-01",
      "endDate": "2035-01-01",
      "interval": "yearly",
      "modifiers": [
        {
          "type": "inflation",
          "enabled": true,
          "rate": 2.5
        },
        {
          "type": "fee",
          "enabled": true,
          "annualRate": 0.75
        }
      ]
    }
  }'
```

### Example 3: Milestone Progress Check

Check if on track for £100,000 house deposit milestone:

```bash
curl -X POST https://your-app.com/api/projections/milestone/milestone-id-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {
      "mode": "simple",
      "growthModel": "compound",
      "growthRate": 6.0,
      "startDate": "2025-01-01",
      "endDate": "2028-01-01",
      "interval": "monthly",
      "modifiers": []
    }
  }'
```

### Example 4: FIRE Retirement Check

Check if on track to retire using saved FIRE settings:

```bash
curl -X POST https://your-app.com/api/projections/fire \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {
      "mode": "advanced",
      "growthModel": "compound",
      "historicalPeriodMonths": 60,
      "interval": "yearly",
      "modifiers": [
        {
          "type": "inflation",
          "enabled": true,
          "rate": 2.0
        }
      ]
    }
  }'
```

### Example 5: What-If Scenario with Contribution Scaling

"What if I increase my monthly contributions by 50%?"

```bash
curl -X POST https://your-app.com/api/projections/portfolio \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {
      "mode": "simple",
      "growthModel": "compound",
      "growthRate": 7.0,
      "startDate": "2025-01-01",
      "endDate": "2040-01-01",
      "interval": "yearly",
      "modifiers": [
        {
          "type": "contribution_scaler",
          "enabled": true,
          "scaleFactor": 1.5,
          "description": "Increase contributions by 50%"
        }
      ]
    }
  }'
```

## Response Examples

### Successful Portfolio Projection Response

```json
{
  "config": {
    "mode": "simple",
    "growthModel": "compound",
    "growthRate": 7.0,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2030-01-01T00:00:00.000Z",
    "interval": "yearly",
    "modifiers": []
  },
  "totalCurrentValue": 50000,
  "totalProjectedValue": 98357.60,
  "totalGrowth": 28357.60,
  "totalContributions": 20000,
  "timePoints": [
    {
      "date": "2025-01-01T00:00:00.000Z",
      "value": 50000,
      "contributions": 0,
      "growth": 0,
      "projectedValue": false
    },
    {
      "date": "2026-01-01T00:00:00.000Z",
      "value": 57833.33,
      "contributions": 4000,
      "growth": 3833.33,
      "projectedValue": true
    },
    {
      "date": "2027-01-01T00:00:00.000Z",
      "value": 66121.67,
      "contributions": 8000,
      "growth": 8121.67,
      "projectedValue": true
    },
    // ... more time points
    {
      "date": "2030-01-01T00:00:00.000Z",
      "value": 98357.60,
      "contributions": 20000,
      "growth": 28357.60,
      "projectedValue": true
    }
  ],
  "assetBreakdown": [
    {
      "assetId": "asset-123",
      "assetName": "Vanguard S&P 500",
      "accountType": "ISA",
      "currentValue": 30000,
      "projectedEndValue": 59014.56,
      "timePoints": [/* asset-specific time points */]
    },
    {
      "assetId": "asset-456",
      "assetName": "SIPP Pension",
      "accountType": "SIPP",
      "currentValue": 20000,
      "projectedEndValue": 39343.04,
      "timePoints": [/* asset-specific time points */]
    }
  ],
  "calculatedAt": "2025-10-09T12:00:00.000Z"
}
```

### Milestone Progress Response

```json
{
  "milestoneId": "milestone-123",
  "milestoneName": "House Deposit",
  "targetValue": 100000,
  "targetDate": "2028-01-01T00:00:00.000Z",
  "projectedValueAtTarget": 95000,
  "isOnTrack": false,
  "shortfall": 5000,
  "shortfallPercentage": 5.0
}
```

**Interpretation:**
- User is projected to have £95,000 by target date
- Shortfall of £5,000 (5% below target)
- `isOnTrack: false` means additional contributions may be needed

### FIRE Progress Response

```json
{
  "fireNumber": 1200000,
  "projectedRetirementDate": "2042-06-15T00:00:00.000Z",
  "projectedRetirementAge": 62,
  "targetRetirementAge": 60,
  "projectedValueAtRetirement": 1180000,
  "isOnTrack": false,
  "yearsAheadOrBehind": 2,
  "monthlyShortfall": 125.50
}
```

**Interpretation:**
- FIRE number (required to retire): £1,200,000
- User can retire at age 62 (2 years behind target age of 60)
- Needs additional £125.50/month to retire on time

## Integration Guides

### Milestone Integration

**How it works:**
1. Milestones have optional `accountType` field (ISA, SIPP, LISA, GIA, or null)
2. Null accountType = portfolio-wide milestone (tracks all assets)
3. Specific accountType = tracks only assets of that type
4. One milestone can track multiple assets (one-to-many relationship)

**Example:** Track ISA assets toward house deposit:

```typescript
// In milestone projection request
{
  "config": { /* projection config */ },
  "milestoneTarget": {
    "milestoneId": "milestone-123",
    "milestoneName": "House Deposit",
    "targetValue": 100000,
    "targetDate": "2028-01-01",
    "accountType": "ISA" // Only track ISA assets
  }
}
```

### FIRE Integration

**How it works:**
1. FIRE is treated as a special milestone with calculated end date
2. End date = User DOB + target retirement age
3. Uses saved `fireSettings` table for user's retirement goals
4. FIRE number calculated from annual income goal and safe withdrawal rate

**Calculation:**
```
FIRE Number = Annual Income Goal / (Safe Withdrawal Rate / 100)
Example: £48,000 / (4 / 100) = £1,200,000
```

**Example:** Check retirement feasibility:

```typescript
// Uses saved FIRE settings
POST /api/projections/fire
{
  "config": {
    "mode": "advanced",
    "growthModel": "compound",
    "historicalPeriodMonths": 60,
    "interval": "yearly",
    "modifiers": [
      { "type": "inflation", "enabled": true, "rate": 2.0 }
    ]
  }
}

// Custom FIRE scenario
POST /api/projections/fire/custom
{
  "config": { /* same as above */ },
  "fireConfig": {
    "dateOfBirth": "1985-06-15",
    "targetRetirementAge": 55,
    "annualIncomeGoal": 60000,
    "safeWithdrawalRate": 3.5,
    "adjustForInflation": true,
    "statePensionAge": 67
  }
}
```

## Usage Patterns

### Pattern 1: Conservative Projection

Use linear growth with inflation adjustment:

```typescript
{
  "mode": "simple",
  "growthModel": "linear",
  "growthRate": 5.0, // Conservative growth
  "modifiers": [
    { "type": "inflation", "enabled": true, "rate": 3.0 },
    { "type": "fee", "enabled": true, "annualRate": 1.0 }
  ]
}
```

### Pattern 2: Optimistic Projection

Use compound growth with historical data:

```typescript
{
  "mode": "advanced",
  "growthModel": "compound",
  "historicalPeriodMonths": 24,
  "anticipatedGrowthRate": 10.0, // Optimistic
  "blendRatio": 0.6, // 60% anticipated, 40% historical
  "modifiers": []
}
```

### Pattern 3: Realistic Projection

Blend historical with anticipated, account for all factors:

```typescript
{
  "mode": "advanced",
  "growthModel": "compound",
  "historicalPeriodMonths": 36,
  "anticipatedGrowthRate": 7.0,
  "blendRatio": 0.5, // 50/50 blend
  "modifiers": [
    { "type": "inflation", "enabled": true, "rate": 2.5 },
    { "type": "fee", "enabled": true, "annualRate": 0.75 },
    { "type": "tax", "enabled": true, "rate": 20 }
  ]
}
```

### Pattern 4: What-If Analysis

Test impact of increased contributions:

```typescript
{
  "mode": "simple",
  "growthModel": "compound",
  "growthRate": 7.0,
  "modifiers": [
    {
      "type": "contribution_scaler",
      "enabled": true,
      "scaleFactor": 1.5, // 50% increase
      "description": "Testing 50% contribution increase"
    }
  ]
}
```

## Best Practices

### Choosing Projection Mode

**Use Simple Mode when:**
- You have a target growth rate in mind
- Historical data is limited (< 3 months)
- You want to test specific scenarios quickly
- Conservative or optimistic projections needed

**Use Advanced Mode when:**
- Asset has 12+ months of historical data
- You want data-driven projections
- You need to blend historical trends with expectations
- Calculating realistic long-term projections

### Choosing Growth Model

**Use Linear when:**
- Conservative baseline projections
- Understanding minimum growth impact
- Short time horizons (< 2 years)
- Educational purposes

**Use Compound when:**
- Realistic investment projections
- Long time horizons (5+ years)
- Accounting for reinvested returns
- Most real-world scenarios

### Modifier Order Matters

Modifiers are applied in sequence. Typical order:

1. **Tax** - Reduce contributions first
2. **Contribution Scaler** - Adjust contribution amounts
3. **Fee** - Deduct from portfolio value
4. **Inflation** - Adjust for purchasing power last

### Date Ranges

**Future Projections:**
```typescript
{
  startDate: new Date(), // Today
  endDate: new Date("2035-01-01") // 10 years from now
}
```

**Historical What-If:**
```typescript
{
  startDate: new Date("2020-01-01"), // Past date
  endDate: new Date("2025-01-01") // Another date
}
```

This allows testing "what if I had started investing in 2020?"

## Error Handling

### Common Errors

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "details": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["config", "growthRate"]
    }
  ]
}
```

**403 Forbidden:**
```json
{
  "error": "Unauthorized",
  "message": "Asset does not belong to user"
}
```

**404 Not Found:**
```json
{
  "error": "Asset not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to project asset",
  "message": "Insufficient historical data for asset XYZ",
  "warnings": [
    "Asset ABC: Only 2 months of historical data available (36 requested)"
  ]
}
```

### Handling Warnings

Projections may succeed but include warnings:

```json
{
  "totalProjectedValue": 150000,
  "warnings": [
    "Asset 'Tech Stocks ISA': Only 6 months of historical data available. Using available data.",
    "Asset 'Property Fund': No recurring contributions configured"
  ]
}
```

**Best Practice:** Display warnings to users, as projections may be less accurate.

## Performance Considerations

### Projection Complexity

**Fast (< 500ms):**
- Single asset, simple mode
- Short time horizons (< 5 years)
- Monthly or yearly intervals

**Moderate (500ms - 2s):**
- Portfolio with 5-10 assets
- Advanced mode with 36 months historical
- Monthly intervals for 10 years

**Slow (2s+):**
- Large portfolios (20+ assets)
- Advanced mode with 120 months historical
- Daily intervals for 10+ years

**Recommendation:** Use WebSocket support for complex projections (future feature)

### Caching Strategy

Currently no caching implemented. Future enhancements:
- In-memory cache with 10-15 minute TTL
- Cache key based on config hash
- Invalidate when underlying asset data changes

## Database Schema Considerations

### Current Implementation

All calculations are on-demand. No projection results are persisted.

### Future Enhancements

Potential database additions for performance:

**1. Materialized View for Growth Metrics:**
```sql
CREATE MATERIALIZED VIEW mv_asset_growth_metrics AS
  WITH growth_rates AS (
    SELECT 
      asset_id,
      value_date,
      value,
      LAG(value) OVER (PARTITION BY asset_id ORDER BY value_date) as prev_value,
      (value - LAG(value) OVER (PARTITION BY asset_id ORDER BY value_date)) / 
        LAG(value) OVER (PARTITION BY asset_id ORDER BY value_date) as growth_rate
    FROM asset_values
  )
  SELECT 
    asset_id,
    AVG(growth_rate) * 100 as avg_growth_rate,
    STDDEV(growth_rate) * 100 as volatility,
    COUNT(*) as data_points
  FROM growth_rates
  WHERE growth_rate IS NOT NULL
  GROUP BY asset_id;

-- Refresh daily
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_asset_growth_metrics;
```

**2. Projection Cache Table:**
```sql
CREATE TABLE projected_values_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL,
  cache_key TEXT NOT NULL, -- Hash of projection config
  result JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projection_cache_key ON projected_values_cache(user_account_id, cache_key);
CREATE INDEX idx_projection_cache_expiry ON projected_values_cache(expires_at);
```

**3. Milestone Enhancements:**

Add to milestones table:
- `target_date` - When user wants to achieve milestone
- Create `milestone_assets` junction table for explicit asset relationships

## Limitations & Notes

### Current Limitations

1. **No Historical Projections Stored:** Projections are calculated on-demand only
2. **Single Currency:** All calculations assume GBP (multi-currency future enhancement)
3. **No Confidence Bands:** Volatility calculated but not yet exposed in API
4. **Security Weighting:** Multi-security assets use first security for historical analysis

### Important Notes

- **Cache-First Strategy:** Projections use cached security history. Ensure cache is populated before projecting calculated assets
- **Recurring Contributions:** Uses existing `recurringContributions` table with RRULE/Cron patterns
- **Modifier Application:** Modifiers apply in array order - order matters!
- **Date Formats:** All dates in ISO 8601 format
- **Authentication:** All endpoints require user authentication via session or API key

## Development Tips

### Testing Projections

```typescript
// Simple 5-year projection with 7% compound growth
const testConfig = {
  mode: "simple" as const,
  growthModel: "compound" as const,
  growthRate: 7.0,
  startDate: new Date(),
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
  interval: "yearly" as const,
  modifiers: []
};

// Make request
const response = await fetch('/api/projections/portfolio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ config: testConfig })
});

const result = await response.json();
console.log(`Current: £${result.totalCurrentValue}`);
console.log(`Projected: £${result.totalProjectedValue}`);
console.log(`Growth: £${result.totalGrowth}`);
```

### Debugging Historical Analysis

If advanced mode returns 0% growth:
1. Check asset has historical values: `GET /api/assets/:assetId/history`
2. Verify security price cache: `GET /api/securities/:securityId/history`
3. Ensure sufficient data points (2+ values minimum)
4. Check date range covers actual data period

### Integration with Existing Features

**Portfolio Page:**
- Call `/api/projections/portfolio` with user's selected date range
- Display projected values alongside actual values
- Use `ProjectionValuesChart` component (new component, not ValuesChart)

**FIRE Page:**
- Call `/api/projections/fire` to show retirement trajectory
- Display `isOnTrack` indicator
- Show `monthlyShortfall` if user is behind schedule

**Milestone Cards:**
- Call `/api/projections/milestones` to check all milestones
- Display progress bars with shortfall information
- Highlight milestones that are off-track

## Architecture Notes

### Service Layer Structure

```
server/services/projections/
├── orchestrator.ts      # Main coordination, aggregation
├── simple.ts            # Simple mode calculations
├── advanced.ts          # Historical analysis
├── modifiers.ts         # Modifier system
├── milestone-tracker.ts # Milestone progress
├── fire-calculator.ts   # FIRE calculations
└── queries.ts          # DB optimizations (future)
```

### Type Safety

All API requests/responses are validated with Zod schemas:
- `projectionConfigSchema` - Validates all projection configurations
- `assetProjectionRequestSchema` - Single asset request
- `portfolioProjectionRequestSchema` - Portfolio request
- Validation errors return 400 with detailed error messages

### Security

- All routes use `requireUser` middleware
- Asset ownership verified before projection
- Milestone ownership verified before progress check
- FIRE settings scoped to user account

## Future Enhancements

1. **WebSocket Streaming:** Real-time progress for complex portfolio projections
2. **Confidence Bands:** Show projection uncertainty based on volatility
3. **Scenario Comparison:** Save and compare multiple projection scenarios
4. **Machine Learning:** Use ML models for more sophisticated predictions
5. **Monte Carlo Simulation:** Probabilistic projections with thousands of scenarios
6. **Tax Optimization:** Model different withdrawal strategies in retirement
7. **Multi-Currency:** Project assets in different currencies with FX rates

---

**Last Updated:** October 9, 2025  
**Version:** 1.0.0  
**Status:** Core API implementation complete, client integration pending


