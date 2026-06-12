import { useMemo } from "react";
import type { FireProjectionData } from "../../schema/projections";

export type TrackChartDataPoint = {
  age: number;
  projected: number;
  target: number;
  actual: number | null;
};

export type ProcessedTrackChartData = {
  chartData: TrackChartDataPoint[];
  minAge: number;
  maxAge: number;
  maxValue: number;
  minValue: number;
};

type UseTrackChartDataOptions = {
  targetAge: number;
  targetAmount: number;
  currentAge: number;
  currentAmount: number;
  projectionData?: FireProjectionData[];
};

export function useTrackChartData({
  targetAge,
  targetAmount,
  currentAge,
  currentAmount,
  projectionData,
}: UseTrackChartDataOptions): ProcessedTrackChartData {
  return useMemo(() => {
    let chartData: TrackChartDataPoint[];

    // Use server projection data if available
    if (projectionData && projectionData.length > 0) {
      chartData = projectionData.map((point) => ({
        age: point.age,
        projected: Number(point.portfolio),
        target: Number(point.target),
        actual: point.age === currentAge ? currentAmount : null,
      }));
    } else {
      // Fallback: Simple client-side calculation
      const fallbackData: TrackChartDataPoint[] = [];
      const years = targetAge - currentAge;
      const growthRate = Math.pow(targetAmount / currentAmount, 1 / years) - 1;

      for (let i = 0; i <= years; i++) {
        const age = currentAge + i;
        const projected = currentAmount * Math.pow(1 + growthRate, i);

        fallbackData.push({
          age,
          projected: Math.round(projected),
          target: targetAmount,
          actual: i === 0 ? currentAmount : null,
        });
      }

      chartData = fallbackData;
    }

    // Calculate domains
    const minAge = chartData[0]?.age || currentAge;
    const maxAge = chartData[chartData.length - 1]?.age || targetAge;

    const allValues: number[] = [];
    chartData.forEach((d) => {
      allValues.push(d.projected, d.target);
      if (d.actual !== null) allValues.push(d.actual);
    });

    const maxValue = allValues.length > 0 ? Math.max(...allValues) : targetAmount;
    const minValue = 0;

    return {
      chartData,
      minAge,
      maxAge,
      maxValue,
      minValue,
    };
  }, [targetAge, targetAmount, currentAge, currentAmount, projectionData]);
}
