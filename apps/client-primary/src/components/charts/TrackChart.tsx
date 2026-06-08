/**
 * @deprecated This component uses Recharts and has been replaced by TrackChartD3.
 *
 * @see TrackChartD3 - D3-based replacement with improved performance and features
 *
 * **Migration Status:** Deprecated as of D3 migration (2026-02)
 *
 * **Replacement:** Use `TrackChartD3` from `@/components/charts/TrackChartD3`
 *
 * **Why kept:** Retained for reference during D3 migration validation period.
 * Once the D3 implementation is confirmed satisfactory in production,
 * this file can be safely removed.
 *
 * **Key Differences in D3 version:**
 * - Direct D3 rendering (better performance)
 * - Configurable curve interpolation (default: monotoneX for smooth lines)
 * - Custom hooks architecture (use-track-chart-data, use-track-chart-scales, etc.)
 * - Same dual data source (server projection OR client-side fallback)
 * - Same API and visual output
 *
 * **All features replicated:**
 * - Three lines: Target (red, dashed), Projected (blue, solid), Actual (green dot)
 * - Dual data source support (server-calculated or client-side growth calculation)
 * - Current value marker at current age
 * - Y-axis formatting: £{value/1000}k
 *
 * @example
 * // Old (deprecated):
 * import TrackChart from "@/components/charts/TrackChart";
 *
 * // New (recommended):
 * import TrackChartD3 from "@/components/charts/TrackChartD3";
 * // Or aliased:
 * import TrackChart from "@/components/charts/TrackChartD3";
 */

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import type { FireProjectionData } from "@milestone/js-common/schema/projections";

type TrackChartProps = {
  targetAge: number;
  targetAmount: number;
  currentAge: number;
  currentAmount: number;
  projectionData?: FireProjectionData[]; // Server-calculated projection data
  className?: string;
};

export default function TrackChart({
  targetAge,
  targetAmount,
  currentAge,
  currentAmount,
  projectionData,
  className
}: TrackChartProps) {
  // ============================================================================
  // SERVER AS SOURCE OF TRUTH
  // ============================================================================
  // If projectionData is provided, use server-calculated projection
  // Otherwise, fall back to simple client-side calculation (for backwards compatibility)
  // ============================================================================

  const data = useMemo(() => {
    // Use server projection data if available
    if (projectionData && projectionData.length > 0) {
      return projectionData.map((point) => ({
        age: point.age.toString(),
        projected: Number(point.portfolio),
        target: Number(point.target),
        actual: point.age === currentAge ? currentAmount : null,
        accessibleValue: point.accessibleValue ? Number(point.accessibleValue) : undefined,
        lockedValue: point.lockedValue ? Number(point.lockedValue) : undefined,
      }));
    }

    // Fallback: Simple client-side calculation (for backwards compatibility)
    const fallbackData = [];
    const years = targetAge - currentAge;
    const growthRate = Math.pow(targetAmount / currentAmount, 1 / years) - 1;
    
    for (let i = 0; i <= years; i++) {
      const age = currentAge + i;
      const projected = currentAmount * Math.pow(1 + growthRate, i);
      
      fallbackData.push({
        age: age.toString(),
        projected: Math.round(projected),
        target: targetAmount,
        actual: i === 0 ? currentAmount : null
      });
    }
    
    return fallbackData;
  }, [projectionData, targetAge, targetAmount, currentAge, currentAmount]);

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <div className="chart-container h-[240px] w-full mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="age" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                tickFormatter={(value) => `£${(value / 1000)}k`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'Projected Growth' || name === 'Projected Portfolio') {
                    return [`£${value.toLocaleString()}`, 'Projected Growth'];
                  }
                  if (name === 'Your Progress' || name === 'Current Value') {
                    return [`£${value.toLocaleString()}`, 'Your Progress'];
                  }
                  if (name === 'Target') {
                    return [`£${value.toLocaleString()}`, 'Target'];
                  }
                  return [`£${value.toLocaleString()}`, name];
                }}
              />
              {/* Target line */}
              <Line 
                type="monotone" 
                dataKey="target" 
                stroke="#EF4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5 }}
                name="Target"
              />
              {/* Projected portfolio line (from server) */}
              <Line 
                type="monotone" 
                dataKey="projected" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                name="Projected Portfolio"
              />
              {/* Current value marker */}
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 6 }}
                name="Your Progress"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
