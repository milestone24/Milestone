import { useMemo } from "react";
import type { FireProjectionData } from "@shared/schema/projections";

export type ProcessedFireChartData = {
  chartData: Array<{
    age: number;
    portfolio: number;
    target: number;
    accessibleValue?: number;
    lockedValue?: number;
  }>;
  minAge: number;
  maxAge: number;
  maxValue: number;
  minValue: number;
  hasAccessibleValue: boolean;
  retirementPoint: {
    age: number;
    portfolio: number;
    target: number;
    accessibleValue?: number;
    lockedValue?: number;
  } | null;
  xAxisTicks: number[];
};

type UseFireChartDataOptions = {
  projectionData: FireProjectionData[];
  currentAge: number;
  targetRetirementAge: number;
  projectedRetirementAge: number;
  yearsToFire: number;
};

export function useFireChartData({
  projectionData,
  currentAge,
  targetRetirementAge,
  projectedRetirementAge,
  yearsToFire,
}: UseFireChartDataOptions): ProcessedFireChartData {
  return useMemo(() => {
    // Transform data to convert DecimalValueString to numbers
    const chartData = projectionData.map((point) => ({
      age: point.age,
      portfolio: Number(point.portfolio),
      target: Number(point.target),
      accessibleValue: point.accessibleValue ? Number(point.accessibleValue) : undefined,
      lockedValue: point.lockedValue ? Number(point.lockedValue) : undefined,
    }));

    // Check if any data points have accessibleValue
    const hasAccessibleValue = projectionData.some(
      (point) => point.accessibleValue !== undefined
    );

    // Calculate retirement age
    const fireAchievedAge = Math.ceil(currentAge + yearsToFire);
    const retirementAge = targetRetirementAge || fireAchievedAge;

    // Find retirement point
    let retirementPoint = chartData.find((point) => point.age === retirementAge);

    // If no exact match, find closest point
    if (!retirementPoint && chartData.length > 0) {
      const closest = chartData.reduce((prev, curr) => {
        if (!prev) return curr;
        return Math.abs(curr.age - retirementAge) < Math.abs(prev.age - retirementAge)
          ? curr
          : prev;
      }, chartData[0]);

      if (closest) {
        retirementPoint = {
          age: retirementAge,
          portfolio: closest.portfolio,
          target: closest.target,
          accessibleValue: closest.accessibleValue,
          lockedValue: closest.lockedValue,
        };
      }
    }

    // Generate X axis ticks
    const xAxisTicks: number[] = [];
    xAxisTicks.push(currentAge);

    if (!xAxisTicks.includes(retirementAge)) {
      xAxisTicks.push(retirementAge);
    }

    // Add regular intervals (decades)
    for (
      let age = Math.ceil(currentAge / 10) * 10;
      age <= projectedRetirementAge;
      age += 10
    ) {
      if (!xAxisTicks.includes(age)) {
        xAxisTicks.push(age);
      }
    }

    if (!xAxisTicks.includes(projectedRetirementAge)) {
      xAxisTicks.push(projectedRetirementAge);
    }

    xAxisTicks.sort((a, b) => a - b);

    // Calculate domains
    const minAge = currentAge;
    const maxAge = projectedRetirementAge;
    const allValues = chartData.map((d) => d.portfolio);
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
    const minValue = 0;

    return {
      chartData,
      minAge,
      maxAge,
      maxValue,
      minValue,
      hasAccessibleValue,
      retirementPoint: retirementPoint || null,
      xAxisTicks,
    };
  }, [projectionData, currentAge, targetRetirementAge, projectedRetirementAge, yearsToFire]);
}
