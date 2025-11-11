import { useMemo } from "react";
import { createDecimalValueString, type ProjectionModifier } from "@shared/schema";
import type {
  Contributor,
  FireProjection,
  FireProjectionData,
  SimpleProjectionConfig,
} from "@shared/schema/projections";
import { convertToAgeBasedProjection } from "@shared/utils/projection-utils";
import type { FireGrowthMode } from "./use-fire-preferences";
import { useDebouncedValue } from "./use-debounced-value";
import { useFireServerProjection } from "./use-fire-server-projection";

export type FireProjectionView = FireProjection & {
  state: "current" | "preview";
};

type UseFireProjectionStateParams = {
  expectedReturn: number;
  baseModifiers: ProjectionModifier[];
  growthMode: FireGrowthMode;
  monthlyInvestment: number;
  currentAge: number;
  userDob: string | Date | null | undefined;
  portfolioFallbackValue?: number;
  debounceMs?: number;
};

type UseFireProjectionStateResult = {
  projectionConfig: Omit<SimpleProjectionConfig, "startDate" | "endDate">;
  fireProjectionData: FireProjectionData[];
  currentProjection: FireProjectionView | undefined;
  isLoading: boolean;
  error: ReturnType<typeof useFireServerProjection>["error"];
  refetch: ReturnType<typeof useFireServerProjection>["refetch"];
  yearsToFire: number;
  contributorsForFire: Contributor[];
  currentPortfolioValue: number;
  fireChartConfig: {
    currentAmount: number;
    monthlyInvestment: number;
    expectedReturn: number;
    targetAmount: number;
    currentAge: number;
  };
  projectedRetirementAge: number;
  projectedRetirementDate?: Date;
  monthlyShortfall?: number;
  fireNumber: number;
};

export function useFireProjectionState({
  expectedReturn,
  baseModifiers,
  growthMode,
  monthlyInvestment,
  currentAge,
  userDob,
  portfolioFallbackValue = 0,
  debounceMs = 500,
}: UseFireProjectionStateParams): UseFireProjectionStateResult {
  const normalizedReturn = Number.isFinite(expectedReturn) ? expectedReturn : 0;

  const modifiers = useMemo<ProjectionModifier[]>(
    () => baseModifiers,
    [baseModifiers]
  );

  const projectionConfig = useMemo<
    Omit<SimpleProjectionConfig, "startDate" | "endDate">
  >(
    () => ({
      mode: "simple",
      growthRate: normalizedReturn,
      growthModel: "linear",
      interval: "yearly",
      modifiers,
      useContributorSpecificGrowthRates: growthMode === "contributor",
    }),
    [growthMode, modifiers, normalizedReturn]
  );

  const debouncedConfig = useDebouncedValue(projectionConfig, debounceMs);

  const {
    projection: currentProjection,
    isLoading,
    error,
    refetch,
  } = useFireServerProjection({
    config: debouncedConfig,
    enabled: !!debouncedConfig,
  });

  const yearsToFire = currentProjection?.yearsAheadOrBehind ?? 0;
  const projectedRetirementAge = currentProjection?.projectedRetirementAge
    ? Math.round(currentProjection.projectedRetirementAge)
    : Math.round(currentAge + yearsToFire);

  const fireNumber = currentProjection?.fireNumber ?? 0;

  const contributorsForFire: Contributor[] =
    currentProjection?.projectionResult?.computationContext?.contributors ?? [];

  console.log(
    "useFireProjectionState currentPortfolioValue",
    currentProjection?.projectionResult?.totalCurrentValue
  );

  const currentPortfolioValue = useMemo(() => {
    if (currentProjection?.projectionResult?.totalCurrentValue) {
      return Number(currentProjection.projectionResult.totalCurrentValue);
    }
    return portfolioFallbackValue;
  }, [
    currentProjection?.projectionResult?.totalCurrentValue,
    portfolioFallbackValue,
  ]);

  const dateOfBirth = useMemo(() => {
    if (!userDob) return null;
    if (userDob instanceof Date) return userDob;
    const parsed = new Date(userDob);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [userDob]);

  const fireProjectionData = useMemo<FireProjectionData[]>(() => {
    if (!dateOfBirth || !currentProjection?.projectionResult) {
      return [];
    }

    return convertToAgeBasedProjection(
      currentProjection.projectionResult.timePoints,
      dateOfBirth,
      createDecimalValueString(fireNumber.toString())
    );
  }, [currentProjection?.projectionResult, dateOfBirth, fireNumber]);

  const fireChartConfig = useMemo(
    () => ({
      currentAmount: currentPortfolioValue,
      monthlyInvestment,
      expectedReturn: normalizedReturn,
      targetAmount: fireNumber,
      currentAge,
    }),
    [
      currentAge,
      currentPortfolioValue,
      fireNumber,
      monthlyInvestment,
      normalizedReturn,
    ]
  );

  return {
    projectionConfig,
    fireProjectionData,
    currentProjection,
    isLoading,
    error,
    refetch,
    yearsToFire,
    contributorsForFire,
    currentPortfolioValue,
    fireChartConfig,
    projectedRetirementAge,
    projectedRetirementDate: currentProjection?.projectedRetirementDate,
    monthlyShortfall: currentProjection?.monthlyShortfall
      ? Number(currentProjection.monthlyShortfall)
      : undefined,
    fireNumber,
  };
}

