# Projections - 5-Minute Quickstart

## Step 1: Test the API (30 seconds)

```bash
# Get your session cookie from browser DevTools (Application → Cookies)
# Then run:

curl -X POST http://localhost:5000/api/projections/portfolio \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE_HERE" \
  -d '{
    "config": {
      "mode": "simple",
      "growthModel": "compound",
      "growthRate": 7.0,
      "startDate": "2025-01-01",
      "endDate": "2030-01-01",
      "interval": "yearly",
      "modifiers": []
    }
  }'
```

✅ **Expected Result:** JSON with `totalCurrentValue`, `totalProjectedValue`, and `timePoints` array

---

## Step 2: Use in a Component (2 minutes)

```typescript
import { usePortfolioProjection } from "@/hooks/use-projections";

function QuickProjection() {
  const config = {
    mode: "simple" as const,
    growthModel: "compound" as const,
    growthRate: 7.0,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
    interval: "yearly" as const,
    modifiers: [],
  };

  const { data, isLoading } = usePortfolioProjection(config);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Your 5-Year Projection</h2>
      <p>Today: £{data?.totalCurrentValue.toLocaleString()}</p>
      <p>In 5 Years: £{data?.totalProjectedValue.toLocaleString()}</p>
      <p>Total Growth: £{data?.totalGrowth.toLocaleString()}</p>
    </div>
  );
}
```

---

## Step 3: Add Modifiers (1 minute)

```typescript
const config = {
  // ... same as above
  modifiers: [
    { type: "inflation" as const, enabled: true, rate: 2.5 },
    { type: "fee" as const, enabled: true, annualRate: 0.75 }
  ],
};
```

---

## Step 4: Check Milestone (1 minute)

```typescript
import { useMilestoneProjection } from "@/hooks/use-projections";

function MilestoneCheck({ milestoneId }: { milestoneId: string }) {
  const config = { /* same config */ };
  const { data } = useMilestoneProjection(milestoneId, config);

  return (
    <div className={data?.isOnTrack ? "text-green-600" : "text-red-600"}>
      {data?.isOnTrack ? "✓ On track!" : `Behind by £${data?.shortfall.toLocaleString()}`}
    </div>
  );
}
```

---

## Step 5: Check FIRE (30 seconds)

```typescript
import { useFIREProjection } from "@/hooks/use-projections";

function FIREStatus() {
  const config = {
    mode: "advanced" as const,
    growthModel: "compound" as const,
    historicalPeriodMonths: 36,
    interval: "yearly" as const,
    modifiers: [],
  };

  const { data } = useFIREProjection(config);

  return (
    <div>
      {data?.isOnTrack ? (
        <p>✓ On track to retire at age {data.targetRetirementAge}</p>
      ) : (
        <p>Behind by {data?.yearsAheadOrBehind} years</p>
      )}
    </div>
  );
}
```

---

## That's It! 🎉

You now have a fully functional projection system.

### What Works Right Now:

✅ API endpoints for asset/portfolio/milestone/FIRE projections  
✅ React Query hooks for easy integration  
✅ Simple mode (user growth rate) and Advanced mode (historical analysis)  
✅ Linear and Compound growth models  
✅ 4 types of modifiers (tax, inflation, fees, contribution scaling)  
✅ Milestone progress tracking  
✅ FIRE retirement feasibility  

### For More Details:

📖 **API Reference:** `docs/Projections.md`  
🔧 **Hook Usage:** `docs/Projections-Client-Hooks.md`  
📋 **Quick Examples:** `docs/Projections-Quick-Reference.md`  

### Next Steps:

Build UI components to make it user-friendly:
- Config form for users to set parameters
- Charts to visualize projections
- Milestone/FIRE progress displays


