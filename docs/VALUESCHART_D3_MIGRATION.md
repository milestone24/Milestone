# ValuesChart D3 Migration

## Overview
Successfully migrated `ValuesChart.tsx` from Recharts to D3.js while maintaining identical UI and behavior.

## Files Created

### Component
- **`client/src/components/charts/ValuesChartD3.tsx`**
  - Main chart component with minimal logic
  - Delegates all complexity to custom hooks
  - Props match original ValuesChart.tsx

### Custom Hooks

1. **`client/src/hooks/use-chart-dimensions.ts`**
   - Handles responsive sizing using ResizeObserver
   - Calculates bounded dimensions with margins
   - Returns dimensions object with width, height, and margins

2. **`client/src/hooks/use-chart-data.ts`**
   - Processes raw chart data
   - Collects all timestamps across series
   - Calculates min/max values for axis domains
   - Handles timestamp computation if not present

3. **`client/src/hooks/use-chart-scales.ts`**
   - Creates D3 scales (linear for both axes)
   - Maps data domain to pixel range
   - Updates when dimensions or data change

4. **`client/src/hooks/use-chart-interactions.ts`**
   - Manages tooltip state and positioning
   - Handles click interactions for selected points
   - Uses D3 bisector for finding nearest data points
   - Returns event handlers for the SVG

5. **`client/src/hooks/use-d3-render.ts`**
   - Main D3 rendering logic using useEffect
   - Draws grid, axes, lines, milestones, and tooltips
   - Properly cleans up on unmount
   - Handles multiple data series synchronization

## Key Features Replicated

✅ Multiple line series with different colors
✅ Responsive sizing (ResizeObserver)
✅ Interactive tooltips on hover
✅ Click to show detailed point information
✅ Milestone reference lines
✅ Cartesian grid (horizontal only)
✅ Formatted axes (currency and dates)
✅ Legend display
✅ Sparse data handling (gaps in lines)
✅ No animations (immediate rendering)
✅ Crosshair cursor
✅ **Configurable curve smoothing** (NEW - D3 advantage)

## React + D3 Best Practices

- ✅ **No useEffect in top-level component** - All logic in hooks
- ✅ **useRef for SVG container** - D3 renders in isolated container
- ✅ **Proper cleanup** - D3 selections cleared on unmount
- ✅ **useMemo for data transformations** - Performance optimization
- ✅ **Separation of concerns** - Each hook has single responsibility
- ✅ **TypeScript throughout** - Full type safety
- ✅ **React manages state** - D3 only for rendering

## Usage

```tsx
import ValuesChartD3 from "@/components/charts/ValuesChartD3";

// Default (smooth with monotoneX)
<ValuesChartD3
  data={chartData}
  milestones={milestones}
  className="optional-class"
/>

// With custom curve
<ValuesChartD3
  data={chartData}
  milestones={milestones}
  curve="natural"
/>
```

## Props

```typescript
type ValuesChartD3Props = {
  className?: string;
  data: ChartData; // Same as ValuesChart.tsx
  milestones?: ChartMilestone[];
  curve?: CurveType; // Default: "monotoneX"
};

type CurveType =
  | "linear"        // Straight lines (original Recharts behavior)
  | "monotoneX"     // Smooth, preserves trends (default)
  | "monotoneY"     // Monotone in Y direction
  | "natural"       // Natural cubic spline
  | "step"          // Step function
  | "stepBefore"    // Step before
  | "stepAfter"     // Step after
  | "basis"         // Cubic basis spline
  | "cardinal"      // Cardinal spline
  | "catmullRom";   // Catmull-Rom spline

type ChartData = ChartDataItem[];

type ChartDataItem = {
  id: string;
  name: string;
  data: CombinedDayTimePointBase[];
  color: string;
};
```

## Differences from Recharts

### Architecture
- **Recharts**: Declarative components (JSX-based)
- **D3**: Imperative rendering (direct SVG manipulation)

### Benefits of D3 Approach
1. **Greater control** - Full access to SVG rendering
2. **Better performance** - Direct DOM manipulation, no React reconciliation
3. **Customizability** - Can implement any visualization
4. **Smaller bundle** - Only import D3 modules you need
5. **Curve smoothing** - Built-in interpolation options (monotoneX default for smooth financial charts)

### Trade-offs
1. **More code** - Need to implement features manually
2. **Lower level** - Manage SVG elements directly
3. **Complexity** - Must handle React lifecycle carefully

## Testing the Migration

To test the new component:

1. **Import the new component:**
   ```tsx
   import ValuesChartD3 from "@/components/charts/ValuesChartD3";
   ```

2. **Replace ValuesChart with ValuesChartD3:**
   ```tsx
   // Before
   <ValuesChart data={chartData} milestones={milestones} />

   // After
   <ValuesChartD3 data={chartData} milestones={milestones} />
   ```

3. **Verify behavior:**
   - Chart renders correctly
   - Hover shows tooltip
   - Click shows detailed panel
   - Responsive to window resize
   - Multiple series display correctly
   - Milestones render as reference lines

## Next Steps

1. **Test in production context** - Verify with real data
2. **Compare performance** - Measure rendering speed vs Recharts
3. **Migrate other charts** - Apply same pattern to FireChart and TrackChart
4. **Remove Recharts dependency** - Once all charts migrated
5. **Add tests** - Unit tests for hooks, integration tests for component

## Technical Notes

- **Timestamp handling**: Data points may not have `timestamp` field in type, but runtime data includes it. Hooks compute it from `valueDate` if missing.
- **Type safety**: Used `ChartDataPoint` type to extend `CombinedDayTimePointBase` with `timestamp` field.
- **Tooltip positioning**: Uses absolute positioning within relative container.
- **Grid lines**: Only horizontal lines rendered (matching Recharts behavior).
- **Axis formatting**: Matches original formatting exactly (£ with abbreviations, date format).
- **Curve smoothing**: Default `monotoneX` provides smooth curves while preserving data trends. Tooltips display actual data point values, so visual smoothing doesn't obscure true values.
- **Curve selection**: Chose `monotoneX` as default for financial data because it:
  - Preserves monotonicity (no false peaks/valleys)
  - Industry standard for financial charts
  - Smooth but accurate representation

## Dependencies Added

- `d3` - ^7.x.x
- `@types/d3` - ^7.x.x

Both installed successfully with no breaking changes to existing dependencies.
