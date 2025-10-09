# Projections Client Hooks - Usage Guide

## Overview

React Query hooks for integrating the Future Value Projections API into your components. All hooks follow standard React Query patterns with automatic caching, refetching, and error handling.

**File:** `client/src/hooks/use-projections.ts`

## Quick Start

### Basic Portfolio Projection

```typescript
import { usePortfolioProjection } from "@/hooks/use-projections";

function MyComponent() {
  const config = {
    mode: "simple" as const,
    growthModel: "compound" as const,
    growthRate: 7.0,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
    interval: "yearly" as const,
    modifiers: [],
  };

  const { data, isLoading, error } = usePortfolioProjection(config);

  if (isLoading) return <div>Loading projection...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Current: £{data?.totalCurrentValue.toLocaleString()}</p>
      <p>Projected: £{data?.totalProjectedValue.toLocaleString()}</p>
      <p>Growth: £{data?.totalGrowth.toLocaleString()}</p>
    </div>
  );
}
```

## Available Hooks

### Query Hooks (Auto-fetching)

| Hook | Purpose | Returns |
|------|---------|---------|
| `useAssetProjection` | Single asset projection | `ProjectionResult` |
| `usePortfolioProjection` | Portfolio projection | `ProjectionResult` |
| `useMilestoneProjection` | Single milestone progress | `MilestoneProgress` |
| `useMilestonesProjection` | All milestones progress | `MilestoneProgress[]` |
| `useFIREProjection` | FIRE using saved settings | `FIREProgress` |
| `useCustomFIREProjection` | FIRE with custom config | `FIREProgress` |

### Mutation Hooks (On-demand)

| Hook | Purpose | Use When |
|------|---------|----------|
| `useAssetProjectionMutation` | Ad-hoc asset projection | User clicks "Calculate" button |
| `usePortfolioProjectionMutation` | Ad-hoc portfolio projection | Form submission |
| `useMilestoneProjectionMutation` | Ad-hoc milestone check | Testing scenarios |
| `useFIREProjectionMutation` | Ad-hoc FIRE check | What-if analysis |

### Convenience Hooks

| Hook | Purpose |
|------|---------|
| `usePortfolioWithMilestoneProjection` | Portfolio + milestone in one call |
| `usePortfolioWithFIREProjection` | Portfolio + FIRE in one call |
| `useDefaultSimpleProjectionConfig` | Get default simple config |
| `useDefaultAdvancedProjectionConfig` | Get default advanced config |

## Detailed Hook Usage

### 1. useAssetProjection

Project a single asset's future value.

**Signature:**
```typescript
useAssetProjection(
  assetId: string | null,
  config: ProjectionConfig | null,
  options?: UseQueryOptions<ProjectionResult>
)
```

**Example:**
```typescript
function AssetProjectionView({ assetId }: { assetId: string }) {
  const [yearsAhead, setYearsAhead] = useState(5);
  const [growthRate, setGrowthRate] = useState(7.0);

  const config: ProjectionConfig = {
    mode: "simple",
    growthModel: "compound",
    growthRate,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + yearsAhead)),
    interval: "monthly",
    modifiers: [],
  };

  const { data, isLoading } = useAssetProjection(assetId, config);

  return (
    <div>
      <input 
        type="number" 
        value={yearsAhead} 
        onChange={(e) => setYearsAhead(Number(e.target.value))}
      />
      <input 
        type="number" 
        value={growthRate} 
        onChange={(e) => setGrowthRate(Number(e.target.value))}
      />
      {!isLoading && data && (
        <Chart data={data.timePoints} />
      )}
    </div>
  );
}
```

**Options:**
```typescript
{
  enabled: true, // Disable auto-fetching if needed
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  refetchOnWindowFocus: false, // Don't refetch on window focus
}
```

### 2. usePortfolioProjection

Project entire portfolio or filtered assets.

**Signature:**
```typescript
usePortfolioProjection(
  config: ProjectionConfig | null,
  options?: {
    accountTypeFilter?: string | null;
    assetIds?: string[];
    enabled?: boolean;
  } & UseQueryOptions<ProjectionResult>
)
```

**Example 1: Full Portfolio**
```typescript
const config = useDefaultSimpleProjectionConfig(10, 7.0);
const { data } = usePortfolioProjection(config);
```

**Example 2: Filter by Account Type**
```typescript
// Project only ISA accounts
const { data: isaProjection } = usePortfolioProjection(config, {
  accountTypeFilter: "ISA"
});

// Project only SIPP accounts
const { data: sippProjection } = usePortfolioProjection(config, {
  accountTypeFilter: "SIPP"
});
```

**Example 3: Specific Assets**
```typescript
const { data } = usePortfolioProjection(config, {
  assetIds: ["asset-1", "asset-2", "asset-3"]
});
```

### 3. useMilestoneProjection

Check if on track for a specific milestone.

**Signature:**
```typescript
useMilestoneProjection(
  milestoneId: string | null,
  config: ProjectionConfig | null,
  options?: UseQueryOptions<MilestoneProgress>
)
```

**Example:**
```typescript
function MilestoneTracker({ milestoneId }: { milestoneId: string }) {
  const config = useDefaultSimpleProjectionConfig(3, 6.0); // 3 years, 6% growth

  const { data: progress, isLoading } = useMilestoneProjection(
    milestoneId,
    config
  );

  if (isLoading) return <div>Checking progress...</div>;

  return (
    <div className={progress?.isOnTrack ? "text-green-600" : "text-red-600"}>
      <h3>{progress?.milestoneName}</h3>
      <p>Target: £{progress?.targetValue.toLocaleString()}</p>
      <p>Projected: £{progress?.projectedValueAtTarget.toLocaleString()}</p>
      {!progress?.isOnTrack && (
        <p>Shortfall: £{progress?.shortfall.toLocaleString()} ({progress?.shortfallPercentage.toFixed(1)}%)</p>
      )}
    </div>
  );
}
```

### 4. useMilestonesProjection

Check progress on all user milestones at once.

**Signature:**
```typescript
useMilestonesProjection(
  config: ProjectionConfig | null,
  options?: UseQueryOptions<MilestoneProgress[]>
)
```

**Example:**
```typescript
function MilestoneDashboard() {
  const config = useDefaultSimpleProjectionConfig(5, 7.0);
  const { data: milestones, isLoading } = useMilestonesProjection(config);

  if (isLoading) return <div>Loading milestones...</div>;

  return (
    <div className="space-y-4">
      {milestones?.map((milestone) => (
        <MilestoneCard key={milestone.milestoneId} milestone={milestone} />
      ))}
    </div>
  );
}
```

### 5. useFIREProjection

Check FIRE retirement feasibility using saved settings.

**Signature:**
```typescript
useFIREProjection(
  config: Omit<ProjectionConfig, "startDate" | "endDate"> | null,
  options?: UseQueryOptions<FIREProgress>
)
```

**Example:**
```typescript
function FIREDashboard() {
  // Note: startDate and endDate are calculated from user's DOB + retirement age
  const config = {
    mode: "advanced" as const,
    growthModel: "compound" as const,
    historicalPeriodMonths: 60,
    interval: "yearly" as const,
    modifiers: [
      { type: "inflation" as const, enabled: true, rate: 2.5 }
    ],
  };

  const { data: fire, isLoading } = useFIREProjection(config);

  if (isLoading) return <div>Calculating retirement...</div>;

  return (
    <div>
      <h2>FIRE Analysis</h2>
      <p>FIRE Number: £{fire?.fireNumber.toLocaleString()}</p>
      <p>Target Retirement Age: {fire?.targetRetirementAge}</p>
      <p>Projected Retirement Age: {fire?.projectedRetirementAge}</p>
      
      {fire?.isOnTrack ? (
        <p className="text-green-600">✓ On track to retire!</p>
      ) : (
        <div className="text-red-600">
          <p>⚠ Behind by {fire?.yearsAheadOrBehind} years</p>
          {fire?.monthlyShortfall && (
            <p>Need additional £{fire.monthlyShortfall.toFixed(2)}/month</p>
          )}
        </div>
      )}
    </div>
  );
}
```

### 6. useCustomFIREProjection

FIRE projection with custom parameters (not using saved settings).

**Signature:**
```typescript
useCustomFIREProjection(
  config: Omit<ProjectionConfig, "startDate" | "endDate"> | null,
  fireConfig: FIREProjectionConfig | null,
  options?: UseQueryOptions<FIREProgress>
)
```

**Example:**
```typescript
function FIREScenarioBuilder() {
  const [retirementAge, setRetirementAge] = useState(60);
  const [annualIncome, setAnnualIncome] = useState(40000);

  const projectionConfig = {
    mode: "simple" as const,
    growthModel: "compound" as const,
    growthRate: 7.0,
    interval: "yearly" as const,
    modifiers: [],
  };

  const fireConfig: FIREProjectionConfig = {
    dateOfBirth: new Date("1985-06-15"),
    targetRetirementAge: retirementAge,
    annualIncomeGoal: annualIncome,
    safeWithdrawalRate: 4.0,
    adjustForInflation: true,
    statePensionAge: 67,
  };

  const { data } = useCustomFIREProjection(projectionConfig, fireConfig);

  return (
    <div>
      <label>
        Retirement Age:
        <input 
          type="number" 
          value={retirementAge}
          onChange={(e) => setRetirementAge(Number(e.target.value))}
        />
      </label>
      {/* Results display */}
    </div>
  );
}
```

## Mutation Hook Usage

Mutations are for on-demand calculations (e.g., when user clicks a button).

### useAssetProjectionMutation

**Example:**
```typescript
function AssetProjectionButton({ assetId }: { assetId: string }) {
  const { mutate, data, isPending } = useAssetProjectionMutation();

  const handleProject = () => {
    const config: ProjectionConfig = {
      mode: "simple",
      growthModel: "compound",
      growthRate: 7.0,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
      interval: "yearly",
      modifiers: [],
    };

    mutate({ assetId, config });
  };

  return (
    <div>
      <button onClick={handleProject} disabled={isPending}>
        {isPending ? "Calculating..." : "Project Future Value"}
      </button>
      {data && <ProjectionResults data={data} />}
    </div>
  );
}
```

### usePortfolioProjectionMutation

**Example with Form:**
```typescript
function ProjectionForm() {
  const { mutate, data, isPending, error } = usePortfolioProjectionMutation();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [growthRate, setGrowthRate] = useState(7.0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const request: PortfolioProjectionRequest = {
      config: {
        mode,
        growthModel: "compound",
        growthRate: mode === "simple" ? growthRate : undefined,
        historicalPeriodMonths: mode === "advanced" ? 36 : undefined,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
        interval: "yearly",
        modifiers: [],
      } as ProjectionConfig,
    };

    mutate(request);
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
        <option value="simple">Simple</option>
        <option value="advanced">Advanced</option>
      </select>
      
      {mode === "simple" && (
        <input 
          type="number" 
          value={growthRate}
          onChange={(e) => setGrowthRate(Number(e.target.value))}
          placeholder="Growth rate %"
        />
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "Calculating..." : "Project"}
      </button>

      {error && <div className="text-red-600">{error.message}</div>}
      {data && <ProjectionChart data={data} />}
    </form>
  );
}
```

## Advanced Examples

### Example 1: Projection with Modifiers

```typescript
function RealisticProjection() {
  const config: ProjectionConfig = {
    mode: "advanced",
    growthModel: "compound",
    historicalPeriodMonths: 36,
    anticipatedGrowthRate: 7.0,
    blendRatio: 0.5,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 20)),
    interval: "yearly",
    modifiers: [
      { type: "inflation", enabled: true, rate: 2.5 },
      { type: "fee", enabled: true, annualRate: 0.75 },
      { type: "tax", enabled: true, rate: 20 }
    ],
  };

  const { data } = usePortfolioProjection(config);

  return <div>{/* Display projection */}</div>;
}
```

### Example 2: What-If Scenario with Contribution Scaling

```typescript
function ContributionWhatIf() {
  const [contributionIncrease, setContributionIncrease] = useState(0); // 0-100%

  const config: ProjectionConfig = {
    mode: "simple",
    growthModel: "compound",
    growthRate: 7.0,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
    interval: "yearly",
    modifiers: [
      {
        type: "contribution_scaler",
        enabled: contributionIncrease !== 0,
        scaleFactor: 1 + contributionIncrease / 100,
        description: `${contributionIncrease}% contribution change`
      }
    ],
  };

  const { data } = usePortfolioProjection(config);

  return (
    <div>
      <label>
        Increase contributions by:
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={contributionIncrease}
          onChange={(e) => setContributionIncrease(Number(e.target.value))}
        />
        {contributionIncrease}%
      </label>
      
      {data && (
        <div>
          <p>Projected value with {contributionIncrease}% increase:</p>
          <p className="text-2xl font-bold">
            £{data.totalProjectedValue.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
```

### Example 3: Milestone Progress Dashboard

```typescript
function MilestonesDashboard() {
  const config = useDefaultSimpleProjectionConfig(5, 7.0);
  const { data: milestones, isLoading } = useMilestonesProjection(config);

  const onTrackCount = milestones?.filter(m => m.isOnTrack).length || 0;
  const behindCount = milestones?.filter(m => !m.isOnTrack).length || 0;

  return (
    <div>
      <div className="stats">
        <div className="text-green-600">On Track: {onTrackCount}</div>
        <div className="text-red-600">Behind: {behindCount}</div>
      </div>

      <div className="milestone-grid">
        {milestones?.map((milestone) => (
          <div 
            key={milestone.milestoneId}
            className={`milestone-card ${milestone.isOnTrack ? 'on-track' : 'behind'}`}
          >
            <h3>{milestone.milestoneName}</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${Math.min(100, (milestone.projectedValueAtTarget / milestone.targetValue) * 100)}%` 
                }}
              />
            </div>
            <p>
              £{milestone.projectedValueAtTarget.toLocaleString()} / 
              £{milestone.targetValue.toLocaleString()}
            </p>
            {!milestone.isOnTrack && (
              <p className="text-red-600">
                £{milestone.shortfall.toLocaleString()} shortfall
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 4: FIRE Retirement Tracker

```typescript
function FIRETracker() {
  const config = {
    mode: "advanced" as const,
    growthModel: "compound" as const,
    historicalPeriodMonths: 60,
    interval: "yearly" as const,
    modifiers: [
      { type: "inflation" as const, enabled: true, rate: 2.0 }
    ],
  };

  const { data: fire, isLoading } = useFIREProjection(config);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="fire-tracker">
      <div className="fire-number">
        <label>Your FIRE Number</label>
        <p className="text-4xl font-bold">
          £{fire?.fireNumber.toLocaleString()}
        </p>
      </div>

      <div className="retirement-timeline">
        <div>
          <label>Target Age</label>
          <p>{fire?.targetRetirementAge}</p>
        </div>
        <div>
          <label>Projected Age</label>
          <p className={fire?.isOnTrack ? "text-green-600" : "text-red-600"}>
            {fire?.projectedRetirementAge}
          </p>
        </div>
      </div>

      {fire && !fire.isOnTrack && (
        <div className="action-needed">
          <p>You're {fire.yearsAheadOrBehind} years behind schedule</p>
          {fire.monthlyShortfall && (
            <p>
              Increase monthly contributions by 
              £{fire.monthlyShortfall.toFixed(2)} to retire on time
            </p>
          )}
        </div>
      )}

      {fire && fire.isOnTrack && (
        <div className="on-track text-green-600">
          <p>✓ You're on track to retire by age {fire.targetRetirementAge}!</p>
        </div>
      )}
    </div>
  );
}
```

### Example 5: Combined Portfolio + FIRE View

```typescript
function PortfolioWithFIRE() {
  const config = {
    mode: "advanced" as const,
    growthModel: "compound" as const,
    historicalPeriodMonths: 36,
    interval: "yearly" as const,
    modifiers: [],
  };

  const { data, isLoading } = usePortfolioWithFIREProjection(config);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <section className="portfolio-projection">
        <h2>Portfolio Projection</h2>
        <p>Current: £{data?.totalCurrentValue.toLocaleString()}</p>
        <p>Projected: £{data?.totalProjectedValue.toLocaleString()}</p>
        <ProjectionChart data={data?.timePoints || []} />
      </section>

      <section className="fire-status">
        <h2>FIRE Status</h2>
        <p>Projected Retirement: {data?.fireProgress?.projectedRetirementDate.toLocaleDateString()}</p>
        <p>At Age: {data?.fireProgress?.projectedRetirementAge}</p>
      </section>
    </div>
  );
}
```

## React Query Options

### Caching Strategy

```typescript
// Cache for 10 minutes (projections don't change frequently)
const { data } = usePortfolioProjection(config, {
  staleTime: 10 * 60 * 1000,
  cacheTime: 15 * 60 * 1000,
});
```

### Conditional Fetching

```typescript
// Only fetch when user has configured projection
const [isConfigured, setIsConfigured] = useState(false);

const { data } = usePortfolioProjection(config, {
  enabled: isConfigured && !!config,
});
```

### Refetch on User Action

```typescript
function RefetchableProjection() {
  const { data, refetch, isRefetching } = usePortfolioProjection(config);

  return (
    <div>
      <button onClick={() => refetch()} disabled={isRefetching}>
        {isRefetching ? "Recalculating..." : "Refresh Projection"}
      </button>
      {data && <Results data={data} />}
    </div>
  );
}
```

### Invalidation When Data Changes

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { portfolioProjection } from "@shared/api/queryKeys";

function AssetUpdater() {
  const queryClient = useQueryClient();
  const { mutate: updateAsset } = useUpdateAssetMutation({
    onSuccess: () => {
      // Invalidate all portfolio projections when assets change
      queryClient.invalidateQueries({ queryKey: portfolioProjection });
    }
  });

  // ... rest of component
}
```

## Error Handling

### Basic Error Display

```typescript
const { data, error, isError } = usePortfolioProjection(config);

if (isError) {
  return (
    <div className="error">
      <p>Failed to calculate projection</p>
      <p className="text-sm text-gray-600">{error?.message}</p>
    </div>
  );
}
```

### Detailed Error Handling

```typescript
const { data, error } = usePortfolioProjection(config, {
  onError: (err) => {
    console.error("Projection failed:", err);
    toast.error(`Projection failed: ${err.message}`);
  },
  retry: 1, // Only retry once
});
```

### Handling Warnings

```typescript
const { data } = usePortfolioProjection(config);

{data?.warnings && data.warnings.length > 0 && (
  <div className="warnings">
    <h4>Warnings:</h4>
    <ul>
      {data.warnings.map((warning, i) => (
        <li key={i} className="text-yellow-600">{warning}</li>
      ))}
    </ul>
  </div>
)}
```

## TypeScript Tips

### Type-Safe Config Creation

```typescript
import { SimpleProjectionConfig, AdvancedProjectionConfig } from "@shared/schema/projections";

const simpleConfig: SimpleProjectionConfig = {
  mode: "simple",
  growthModel: "compound",
  growthRate: 7.0,
  startDate: new Date(),
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
  interval: "yearly",
  modifiers: [],
};

const advancedConfig: AdvancedProjectionConfig = {
  mode: "advanced",
  growthModel: "compound",
  historicalPeriodMonths: 36,
  blendRatio: 0.5,
  startDate: new Date(),
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
  interval: "yearly",
  modifiers: [],
};
```

### Type-Safe Modifiers

```typescript
import { ProjectionModifier } from "@shared/schema/projections";

const modifiers: ProjectionModifier[] = [
  { type: "tax", enabled: true, rate: 20 },
  { type: "inflation", enabled: true, rate: 2.5 },
  { type: "fee", enabled: true, annualRate: 0.75 },
  { type: "contribution_scaler", enabled: false, scaleFactor: 1.5 },
];
```

## Common Patterns

### Pattern 1: Controlled Projection Config

User controls all projection parameters:

```typescript
function ProjectionController() {
  const [years, setYears] = useState(5);
  const [growthRate, setGrowthRate] = useState(7.0);
  const [inflationEnabled, setInflationEnabled] = useState(false);

  const config: ProjectionConfig = useMemo(() => ({
    mode: "simple" as const,
    growthModel: "compound" as const,
    growthRate,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + years)),
    interval: "yearly" as const,
    modifiers: inflationEnabled ? [
      { type: "inflation" as const, enabled: true, rate: 2.5 }
    ] : [],
  }), [years, growthRate, inflationEnabled]);

  const { data } = usePortfolioProjection(config);

  return (
    <div>
      {/* Form controls */}
      {data && <Results data={data} />}
    </div>
  );
}
```

### Pattern 2: Preset Scenarios

Offer predefined projection scenarios:

```typescript
const SCENARIOS = {
  conservative: {
    mode: "simple" as const,
    growthModel: "linear" as const,
    growthRate: 4.0,
    modifiers: [
      { type: "inflation" as const, enabled: true, rate: 3.0 },
      { type: "fee" as const, enabled: true, annualRate: 1.5 },
    ],
  },
  moderate: {
    mode: "advanced" as const,
    growthModel: "compound" as const,
    historicalPeriodMonths: 36,
    modifiers: [
      { type: "inflation" as const, enabled: true, rate: 2.5 },
    ],
  },
  optimistic: {
    mode: "simple" as const,
    growthModel: "compound" as const,
    growthRate: 10.0,
    modifiers: [],
  },
};

function ScenarioComparison() {
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>("moderate");

  const config: ProjectionConfig = useMemo(() => ({
    ...SCENARIOS[scenario],
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
    interval: "yearly" as const,
  }), [scenario]);

  const { data } = usePortfolioProjection(config);

  return (
    <div>
      <select value={scenario} onChange={(e) => setScenario(e.target.value as any)}>
        <option value="conservative">Conservative</option>
        <option value="moderate">Moderate</option>
        <option value="optimistic">Optimistic</option>
      </select>
      {data && <ScenarioResults scenario={scenario} data={data} />}
    </div>
  );
}
```

### Pattern 3: Side-by-Side Comparison

Compare current trajectory vs increased contributions:

```typescript
function ComparisonView() {
  const baseConfig = useDefaultSimpleProjectionConfig(10, 7.0);

  const increasedConfig: ProjectionConfig = {
    ...baseConfig,
    modifiers: [
      { type: "contribution_scaler", enabled: true, scaleFactor: 1.5 }
    ],
  };

  const { data: currentProjection } = usePortfolioProjection(baseConfig);
  const { data: increasedProjection } = usePortfolioProjection(increasedConfig);

  const difference = (increasedProjection?.totalProjectedValue || 0) - 
                     (currentProjection?.totalProjectedValue || 0);

  return (
    <div className="comparison">
      <div className="current">
        <h3>Current Path</h3>
        <p>£{currentProjection?.totalProjectedValue.toLocaleString()}</p>
      </div>
      <div className="increased">
        <h3>With 50% More Contributions</h3>
        <p>£{increasedProjection?.totalProjectedValue.toLocaleString()}</p>
        <p className="text-green-600">+£{difference.toLocaleString()} more!</p>
      </div>
    </div>
  );
}
```

### Pattern 4: Milestone-Linked Projection

Automatically set projection end date to milestone target:

```typescript
function MilestoneLinkedProjection({ milestoneId }: { milestoneId: string }) {
  const { data: milestone } = useMilestone(milestoneId); // Existing hook

  const config: ProjectionConfig | null = useMemo(() => {
    if (!milestone) return null;

    return {
      mode: "simple" as const,
      growthModel: "compound" as const,
      growthRate: 6.0,
      startDate: new Date(),
      endDate: milestone.targetDate || new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
      interval: "monthly" as const,
      modifiers: [],
    };
  }, [milestone]);

  const { data: progress } = useMilestoneProjection(milestoneId, config);

  return (
    <div>
      {progress && (
        <MilestoneProgressCard milestone={milestone} progress={progress} />
      )}
    </div>
  );
}
```

## Performance Tips

### 1. Memoize Configs

```typescript
const config = useMemo(() => ({
  mode: "simple" as const,
  growthModel: "compound" as const,
  growthRate: 7.0,
  startDate: new Date(),
  endDate: futureDate,
  interval: "yearly" as const,
  modifiers: [],
}), [futureDate]); // Only recreate when dependencies change
```

### 2. Disable Auto-Fetch for Heavy Projections

```typescript
const { data, refetch } = usePortfolioProjection(config, {
  enabled: false, // Don't auto-fetch
});

// Fetch when user clicks button
<button onClick={() => refetch()}>Calculate Projection</button>
```

### 3. Use Mutations for User-Triggered Calculations

```typescript
// Better for "calculate" buttons
const { mutate } = usePortfolioProjectionMutation();

<button onClick={() => mutate({ config })}>
  Calculate
</button>
```

## Integration with Existing Hooks

### Example: Portfolio Page Integration

```typescript
import { usePortfolio } from "@/context/PortfolioContext";
import { usePortfolioProjection } from "@/hooks/use-projections";

function PortfolioPage() {
  const { assets, portfolioOverview } = usePortfolio();
  
  const projectionConfig = useDefaultSimpleProjectionConfig(5, 7.0);
  const { data: projection } = usePortfolioProjection(projectionConfig);

  return (
    <div>
      <CurrentPortfolioView assets={assets} overview={portfolioOverview} />
      {projection && <FutureProjectionView projection={projection} />}
    </div>
  );
}
```

### Example: FIRE Page Integration

```typescript
import { usePortfolio } from "@/context/PortfolioContext";
import { useFIREProjection } from "@/hooks/use-projections";

function FIREPage() {
  const { fireSettings } = usePortfolio();
  
  const config = {
    mode: "advanced" as const,
    growthModel: "compound" as const,
    historicalPeriodMonths: 60,
    interval: "yearly" as const,
    modifiers: [
      { type: "inflation" as const, enabled: fireSettings?.adjustInflation || false, rate: 2.0 }
    ],
  };

  const { data: fireProgress } = useFIREProjection(config);

  return (
    <div>
      <FIRESettings settings={fireSettings} />
      {fireProgress && <FIREProjectionResults progress={fireProgress} />}
    </div>
  );
}
```

## Troubleshooting

### Projection Not Updating

**Problem:** Config changes but projection doesn't recalculate

**Solution:** Ensure config is memoized or use mutation instead of query

```typescript
// ❌ Wrong - new object every render
const config = {
  mode: "simple",
  growthRate: 7.0,
  // ...
};

// ✅ Correct - memoized
const config = useMemo(() => ({
  mode: "simple",
  growthRate: 7.0,
  // ...
}), []);
```

### "Insufficient historical data" Error

**Problem:** Advanced mode fails with insufficient data warning

**Solution:** Reduce `historicalPeriodMonths` or switch to simple mode

```typescript
const { data, error } = usePortfolioProjection(config, {
  onError: (err) => {
    if (err.message.includes("Insufficient historical data")) {
      // Fallback to simple mode
      setMode("simple");
    }
  }
});
```

### Projection Takes Too Long

**Problem:** Query hangs for complex portfolios

**Solution:** Use mutation with manual trigger or reduce complexity

```typescript
// Instead of auto-fetch query:
const { data } = usePortfolioProjection(config);

// Use mutation with button trigger:
const { mutate, isPending } = usePortfolioProjectionMutation();

<button onClick={() => mutate({ config })} disabled={isPending}>
  {isPending ? "Calculating..." : "Calculate Projection"}
</button>
```

## Best Practices

1. **Always memoize configs** to prevent unnecessary recalculations
2. **Use mutations for user-triggered calculations** (button clicks)
3. **Use queries for auto-updating data** (dashboard displays)
4. **Set appropriate staleTime** (5-10 minutes for projections)
5. **Handle loading states gracefully** (show skeletons or spinners)
6. **Display warnings to users** if projection has caveats
7. **Invalidate on data changes** (when assets, contributions, or settings update)

## Next Steps

After implementing these hooks in your components:

1. Create `ProjectionConfig` UI component for user configuration
2. Build `MilestoneProgress` component for milestone tracking display
3. Create `FIREProgress` component for retirement analysis display
4. Implement `ProjectionValuesChart` for visualization (separate from ValuesChart)

---

**Status:** Client hooks complete and ready to use  
**Dependencies:** Projection API (✅ Complete)  
**Next:** UI components for configuration and visualization


