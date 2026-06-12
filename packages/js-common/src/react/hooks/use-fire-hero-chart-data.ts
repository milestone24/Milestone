import { useMemo } from "react";
import Decimal from "decimal.js";
import type { FireProjectionData } from "../../schema/projections";

type StackDatum = Record<string, number>;

export function buildFireHeroStackData(
  chartData: Map<string, FireProjectionData[]>,
  keys: string[]
): StackDatum[] {
  const ageSet = new Set<number>();
  for (const series of chartData.values()) {
    for (const point of series) ageSet.add(point.age);
  }

  const ages = [...ageSet].sort((a, b) => a - b);

  const seriesMaps = new Map<string, Map<number, number>>();
  for (const [key, series] of chartData) {
    const valueByAge = new Map<number, number>();
    for (const point of series) {
      valueByAge.set(point.age, Decimal(point.portfolio).toNumber());
    }
    seriesMaps.set(key, valueByAge);
  }

  return ages.map((age) => {
    const datum: StackDatum = { age };
    for (const key of keys) {
      datum[key] = seriesMaps.get(key)?.get(age) ?? 0;
    }
    return datum;
  });
}

export type FireHeroLegendValues = {
  perType: Map<string, number>;
  total: number;
};

export function useFireHeroChartLegend(
  chartData: Map<string, FireProjectionData[]>,
  targetRetirementAge: number
): FireHeroLegendValues {
  const keys = useMemo(() => [...chartData.keys()], [chartData]);
  const stackData = useMemo(
    () => buildFireHeroStackData(chartData, keys),
    [chartData, keys]
  );

  return useMemo<FireHeroLegendValues>(() => {
    const target =
      stackData.find((datum) => datum["age"] === targetRetirementAge) ??
      stackData[stackData.length - 1];

    if (!target) return { perType: new Map(), total: 0 };

    const perType = new Map<string, number>();
    let total = 0;
    for (const key of keys) {
      const value = target[key] ?? 0;
      perType.set(key, value);
      total += value;
    }
    return { perType, total };
  }, [stackData, keys, targetRetirementAge]);
}

export function useFireHeroStackData(
  chartData: Map<string, FireProjectionData[]>
) {
  const keys = useMemo(() => [...chartData.keys()], [chartData]);
  const stackData = useMemo(
    () => buildFireHeroStackData(chartData, keys),
    [chartData, keys]
  );

  return { keys, stackData };
}
