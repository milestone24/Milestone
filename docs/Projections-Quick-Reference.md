# Projections API - Quick Reference

## Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projections/asset/:assetId` | POST | Project single asset |
| `/api/projections/portfolio` | POST | Project entire portfolio |
| `/api/projections/milestone/:milestoneId` | POST | Check milestone progress |
| `/api/projections/milestones` | POST | Check all milestones |
| `/api/projections/fire` | POST | FIRE using saved settings |
| `/api/projections/fire/custom` | POST | FIRE with custom config |

## Minimal Request Examples

### Simple 5-Year Projection (Most Common)

```json
POST /api/projections/portfolio

{
  "config": {
    "mode": "simple",
    "growthModel": "compound",
    "growthRate": 7.0,
    "startDate": "2025-01-01",
    "endDate": "2030-01-01",
    "interval": "yearly",
    "modifiers": []
  }
}
```

### Advanced with Inflation

```json
POST /api/projections/portfolio

{
  "config": {
    "mode": "advanced",
    "growthModel": "compound",
    "historicalPeriodMonths": 36,
    "startDate": "2025-01-01",
    "endDate": "2035-01-01",
    "interval": "yearly",
    "modifiers": [
      { "type": "inflation", "enabled": true, "rate": 2.5 }
    ]
  }
}
```

### Check Milestone

```json
POST /api/projections/milestone/YOUR_MILESTONE_ID

{
  "config": {
    "mode": "simple",
    "growthModel": "compound",
    "growthRate": 6.0,
    "startDate": "2025-01-01",
    "endDate": "2028-01-01",
    "interval": "monthly",
    "modifiers": []
  }
}
```

### Check FIRE

```json
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
```

## Config Options Reference

### Required Fields

```typescript
{
  mode: "simple" | "advanced",
  growthModel: "linear" | "compound",
  startDate: Date,
  endDate: Date,
  interval: "daily" | "weekly" | "monthly" | "yearly",
  modifiers: ProjectionModifier[]
}
```

### Simple Mode Additional Fields

```typescript
{
  growthRate: number // -100 to 1000 (percentage)
}
```

### Advanced Mode Additional Fields

```typescript
{
  historicalPeriodMonths: number, // 1-120, default: 36
  anticipatedGrowthRate?: number, // Optional blend
  blendRatio: number // 0-1, default: 0.5
}
```

## Modifier Reference

### Tax Modifier

```json
{
  "type": "tax",
  "enabled": true,
  "rate": 20
}
```

### Inflation Modifier

```json
{
  "type": "inflation",
  "enabled": true,
  "rate": 2.5
}
```

### Contribution Scaler

```json
{
  "type": "contribution_scaler",
  "enabled": true,
  "scaleFactor": 1.5
}
```

### Fee Modifier

```json
{
  "type": "fee",
  "enabled": true,
  "annualRate": 0.75
}
```

## Response Fields

### ProjectionResult

```typescript
{
  totalCurrentValue: number,      // Current portfolio value
  totalProjectedValue: number,    // Projected end value
  totalGrowth: number,            // Growth amount (excluding contributions)
  totalContributions: number,     // Sum of all contributions
  timePoints: [                   // Time series data
    {
      date: Date,
      value: number,
      contributions: number,
      growth: number,
      projectedValue: boolean
    }
  ],
  assetBreakdown: [               // Per-asset details
    {
      assetId: string,
      assetName: string,
      accountType: string,
      currentValue: number,
      projectedEndValue: number,
      timePoints: ProjectionTimePoint[]
    }
  ]
}
```

### MilestoneProgress

```typescript
{
  milestoneId: string,
  milestoneName: string,
  targetValue: number,
  projectedValueAtTarget: number,
  isOnTrack: boolean,
  shortfall: number,              // Negative = ahead, Positive = behind
  shortfallPercentage: number
}
```

### FIREProgress

```typescript
{
  fireNumber: number,             // Required portfolio value
  projectedRetirementDate: Date,
  projectedRetirementAge: number,
  targetRetirementAge: number,
  projectedValueAtRetirement: number,
  isOnTrack: boolean,
  yearsAheadOrBehind: number,     // Negative = early, Positive = late
  monthlyShortfall?: number       // Extra £/month needed if behind
}
```

## Common Use Cases

### Use Case 1: Retirement Planning

"When can I retire with £1M?"

```json
POST /api/projections/fire/custom
{
  "config": {
    "mode": "advanced",
    "growthModel": "compound",
    "historicalPeriodMonths": 60,
    "interval": "yearly",
    "modifiers": []
  },
  "fireConfig": {
    "dateOfBirth": "1985-06-15",
    "targetRetirementAge": 60,
    "annualIncomeGoal": 40000,
    "safeWithdrawalRate": 4.0,
    "adjustForInflation": true,
    "statePensionAge": 67
  }
}
```

### Use Case 2: House Deposit Goal

"Will I have £50k for a house deposit in 3 years?"

```json
POST /api/projections/milestone/house-deposit-milestone-id
{
  "config": {
    "mode": "simple",
    "growthModel": "compound",
    "growthRate": 5.0,
    "startDate": "2025-01-01",
    "endDate": "2028-01-01",
    "interval": "monthly",
    "modifiers": []
  }
}
```

### Use Case 3: ISA Allowance Optimization

"How much will my ISAs be worth if I max them out?"

```json
POST /api/projections/portfolio
{
  "config": {
    "mode": "advanced",
    "growthModel": "compound",
    "historicalPeriodMonths": 36,
    "startDate": "2025-01-01",
    "endDate": "2035-01-01",
    "interval": "yearly",
    "modifiers": [
      {
        "type": "contribution_scaler",
        "enabled": true,
        "scaleFactor": 2.0,
        "description": "Double contributions to max ISA"
      }
    ]
  },
  "accountTypeFilter": "ISA"
}
```

### Use Case 4: Conservative Estimate

"Worst case scenario with fees and inflation?"

```json
POST /api/projections/portfolio
{
  "config": {
    "mode": "simple",
    "growthModel": "linear",
    "growthRate": 4.0,
    "startDate": "2025-01-01",
    "endDate": "2040-01-01",
    "interval": "yearly",
    "modifiers": [
      { "type": "inflation", "enabled": true, "rate": 3.0 },
      { "type": "fee", "enabled": true, "annualRate": 1.5 },
      { "type": "tax", "enabled": true, "rate": 20 }
    ]
  }
}
```

## Quick Tips

1. **Start Simple:** Use simple mode with compound growth for initial tests
2. **Add Modifiers Gradually:** Start without modifiers, then add one at a time
3. **Realistic Growth Rates:** UK stock market historical average is ~7-8% annually
4. **Interval Selection:** Use yearly for long projections, monthly for detailed near-term
5. **Blend Ratios:** 0.5 is balanced, < 0.5 favors historical data, > 0.5 favors your estimate

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Asset not found" | Asset ID doesn't exist | Check asset ID is correct |
| "Unauthorized" | Asset doesn't belong to user | Verify authentication |
| "Insufficient historical data" | Not enough data for advanced mode | Use simple mode or reduce historicalPeriodMonths |
| "Invalid request" | Validation failed | Check request body matches schema |
| "FIRE settings not found" | No saved FIRE config | Use `/fire/custom` endpoint instead |
| "User date of birth not found" | Profile incomplete | Update user profile with DOB |

## TypeScript Integration

Import types from shared schema:

```typescript
import {
  ProjectionConfig,
  ProjectionResult,
  MilestoneProgress,
  FIREProgress,
  SimpleProjectionConfig,
  AdvancedProjectionConfig,
} from "@shared/schema/projections";

// Type-safe request
const config: SimpleProjectionConfig = {
  mode: "simple",
  growthModel: "compound",
  growthRate: 7.0,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2030-01-01"),
  interval: "yearly",
  modifiers: []
};

// Type-safe response
const result: ProjectionResult = await fetch('/api/projections/portfolio', {
  method: 'POST',
  body: JSON.stringify({ config })
}).then(r => r.json());
```

## For More Details

See `docs/Projections.md` for:
- Detailed formula explanations
- Complete response examples
- Performance benchmarks
- Future enhancement roadmap
- Database schema considerations


