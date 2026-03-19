import {
  SimpleProjectionConfigWithDateRange,
  ProjectionTimePoint,
  ContributorSchedule,
  Contributor,
} from "@shared/schema/projections";
import { ModifierChain, calculateYearsElapsed } from "./projection-modifiers";
import {
  calculatePeriodContributions,
  applyModifiersToValue,
  createProjectionTimePoint,
  getNextProjectionDate,
  getDateIncrement,
  getEffectiveGrowthRate,
  getProjectionGridDates,
} from "./projection-utils";
import { createDecimalValueString, DecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";
import { calculateAccessibleValue } from "./projection-accessible-value";
import { BonusAnnualUsage } from "./projection-bonus-calculator";

// ============================================================================
// SIMPLE PROJECTION SERVICE
// ============================================================================

/**
 * Input for simple projections
 */
export interface SimpleProjectionInput {
  currentValue: DecimalValueString;
  currentDate?: Date;
  scheduledContributions: ContributorSchedule[];
  contributor: Contributor;
  dateOfBirth?: Date;
  config: SimpleProjectionConfigWithDateRange;
  modifierChain?: ModifierChain;
}

/**
 * Result of a simple projection
 */
export interface SimpleProjectionResult {
  timePoints: ProjectionTimePoint[];
  totalGrowth: DecimalValueString;
  totalContributions: DecimalValueString;
  finalValue: DecimalValueString;
}

// ============================================================================
// LINEAR GROWTH
// ============================================================================

/**
 * Apply linear growth - flat rate applied only to initial value
 * Formula: FV = PV + (PV * rate * years)
 */
export function projectWithLinearGrowth(
  principal: DecimalValueString,
  annualGrowthRate: number,
  years: number
): number {
  const growthAmount = Decimal(principal)
    .mul(Decimal(annualGrowthRate).div(100))
    .mul(years)
    .toNumber();
  return Decimal(principal).add(growthAmount).toNumber();
}

// ============================================================================
// COMPOUND GROWTH
// ============================================================================

/**
 * Apply compound growth - rate applied to accumulated value
 * Formula: FV = PV * (1 + rate)^years
 */
export function projectWithCompoundGrowth(
  principal: number,
  annualGrowthRate: number,
  years: number
): number {
  return principal * Math.pow(1 + annualGrowthRate / 100, years);
}

/**
 * Calculate compound growth with regular contributions
 * Formula: FV = PV * (1 + r)^n + PMT * [((1 + r)^n - 1) / r]
 * Where PMT is the periodic payment
 */
export function projectWithCompoundGrowthAndContributions(
  principal: number,
  annualContribution: number,
  annualGrowthRate: number,
  years: number
): number {
  const r = annualGrowthRate / 100;
  const n = years;

  // Future value of principal
  const fvPrincipal = principal * Math.pow(1 + r, n);

  // Future value of annuity (contributions)
  const fvContributions =
    r !== 0
      ? annualContribution * ((Math.pow(1 + r, n) - 1) / r)
      : annualContribution * n; // Handle zero growth rate

  return fvPrincipal + fvContributions;
}

// ============================================================================
// TIME SERIES GENERATION
// ============================================================================

/**
 * Generate projection time series with linear growth
 */
export function generateLinearProjectionTimeSeries(
  input: SimpleProjectionInput
): ProjectionTimePoint[] {
  const {
    currentValue,
    currentDate,
    scheduledContributions,
    contributor,
    dateOfBirth,
    config,
    modifierChain,
  } = input;

  const timePoints: ProjectionTimePoint[] = [];
  const useCalendarGrid =
    "seriesAlignment" in config && config.seriesAlignment === "calendar";
  const gridDates = getProjectionGridDates(config);
  const startDate = new Date(config.startDate);

  const firstForwardIdx = gridDates.findIndex((d) => d >= startDate);
  const forwardStartIdx = firstForwardIdx >= 0 ? firstForwardIdx : 0;
  const effectiveStartDate: Date =
    useCalendarGrid && gridDates[forwardStartIdx]
      ? new Date(gridDates[forwardStartIdx])
      : new Date(startDate);

  // PLACEHOLDER: Backfill points (dates before startDate) use currentValue instead of historical value.
  // Real solution: obtain portfolio/contributor value at each backfill date (e.g. from asset_values:
  // latest value per asset where value_date <= backfillDate, then sum). Pass those values into the
  // projection (e.g. backfillValues: Record<dateKey, value> per contributor or portfolio-wide) and
  // use them here instead of placeholderValue. Until then, month-over-month and other backfill-derived
  // metrics (e.g. "vs last month") will be wrong when backfill dates are present.
  if (useCalendarGrid && forwardStartIdx > 0) {
    const placeholderValue = createDecimalValueString(
      Decimal(currentValue).toString()
    );
    for (let i = 0; i < forwardStartIdx; i++) {
      const d = gridDates[i];
      if (!d) continue;
      const accessible = calculateAccessibleValue(
        contributor,
        placeholderValue,
        d,
        dateOfBirth
      );
      timePoints.push(
        createProjectionTimePoint(
          d,
          placeholderValue,
          createDecimalValueString("0"),
          createDecimalValueString("0"),
          false,
          createDecimalValueString("0"),
          accessible.accessibleValue,
          accessible.lockedValue
        )
      );
    }
  }

  const incrementDate = getDateIncrement(config.interval);
  let accumulatedValue = createDecimalValueString(
    Decimal(currentValue).toString()
  );
  let totalContributions = Decimal(0);
  let totalBonuses = Decimal(0);
  let totalGrowth = Decimal(0);
  let annualBonusUsage = new Map<string, BonusAnnualUsage>();

  const initialAccessible = calculateAccessibleValue(
    contributor,
    accumulatedValue,
    effectiveStartDate,
    dateOfBirth
  );

  timePoints.push(
    createProjectionTimePoint(
      effectiveStartDate,
      accumulatedValue,
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      false,
      createDecimalValueString("0"),
      initialAccessible.accessibleValue,
      initialAccessible.lockedValue
    )
  );

  const dateSequence = useCalendarGrid
    ? gridDates.slice(forwardStartIdx + 1).filter((d) => d <= config.endDate)
    : (function nextDates() {
        const out: Date[] = [];
        let prev = new Date(effectiveStartDate);
        while (prev < config.endDate) {
          const d = getNextProjectionDate(
            prev,
            incrementDate,
            config.endDate
          );
          out.push(new Date(d));
          prev = d;
        }
        return out;
      })();

  for (const currentProjectionDate of dateSequence) {
    if (!currentProjectionDate) continue;
    const yearsFromStart = calculateYearsElapsed(
      config.startDate,
      currentProjectionDate
    );

    const effectiveGrowthRate = getEffectiveGrowthRate(contributor, config);
    const growthRate = Decimal(effectiveGrowthRate).div(100);
    const growthValue =
      effectiveGrowthRate === 0
        ? Decimal(0)
        : Decimal(currentValue).mul(growthRate).mul(yearsFromStart);

    const lastTimePoint = timePoints[timePoints.length - 1];
    const periodResult = calculatePeriodContributions(
      contributor,
      lastTimePoint ? lastTimePoint.date : config.startDate,
      currentProjectionDate,
      modifierChain,
      accumulatedValue,
      config.startDate,
      annualBonusUsage
    );

    const periodContributions = periodResult.contributions;
    const periodBonuses = Decimal(periodResult.bonuses);
    annualBonusUsage = periodResult.updatedAnnualUsage;

    totalContributions = Decimal(totalContributions).add(periodContributions);
    totalBonuses = totalBonuses.add(periodBonuses);
    totalGrowth = growthValue;
    accumulatedValue = createDecimalValueString(
      Decimal(currentValue)
        .add(growthValue)
        .add(totalContributions)
        .add(totalBonuses)
        .toString()
    );

    const finalValue = applyModifiersToValue(
      accumulatedValue,
      accumulatedValue,
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    const accessible = calculateAccessibleValue(
      contributor,
      finalValue,
      currentProjectionDate,
      dateOfBirth
    );

    timePoints.push(
      createProjectionTimePoint(
        currentProjectionDate,
        finalValue,
        createDecimalValueString(Decimal(totalContributions).toString()),
        createDecimalValueString(Decimal(totalGrowth).toString()),
        true,
        createDecimalValueString(totalBonuses.toString()),
        accessible.accessibleValue,
        accessible.lockedValue
      )
    );
  }

  return timePoints;
}

/**
 * Generate projection time series with compound growth
 */
export function generateCompoundProjectionTimeSeries(
  input: SimpleProjectionInput
): ProjectionTimePoint[] {
  const {
    currentValue,
    currentDate,
    scheduledContributions,
    contributor,
    dateOfBirth,
    config,
    modifierChain,
  } = input;

  const timePoints: ProjectionTimePoint[] = [];
  const useCalendarGrid =
    "seriesAlignment" in config && config.seriesAlignment === "calendar";
  const gridDates = getProjectionGridDates(config);
  const startDate = new Date(config.startDate);

  const firstForwardIdx = gridDates.findIndex((d) => d >= startDate);
  const forwardStartIdx = firstForwardIdx >= 0 ? firstForwardIdx : 0;
  const effectiveStartDate: Date =
    useCalendarGrid && gridDates[forwardStartIdx]
      ? new Date(gridDates[forwardStartIdx])
      : new Date(startDate);

  // PLACEHOLDER: Backfill points (dates before startDate) use currentValue instead of historical value.
  // Real solution: obtain portfolio/contributor value at each backfill date (e.g. from asset_values:
  // latest value per asset where value_date <= backfillDate, then sum). Pass those values into the
  // projection (e.g. backfillValues: Record<dateKey, value> per contributor or portfolio-wide) and
  // use them here instead of placeholderValue. Until then, month-over-month and other backfill-derived
  // metrics (e.g. "vs last month") will be wrong when backfill dates are present.
  if (useCalendarGrid && forwardStartIdx > 0) {
    const placeholderValue = createDecimalValueString(
      Decimal(currentValue).toString()
    );
    for (let i = 0; i < forwardStartIdx; i++) {
      const d = gridDates[i];
      if (!d) continue;
      const accessible = calculateAccessibleValue(
        contributor,
        placeholderValue,
        d,
        dateOfBirth
      );
      timePoints.push(
        createProjectionTimePoint(
          d,
          placeholderValue,
          createDecimalValueString("0"),
          createDecimalValueString("0"),
          false,
          createDecimalValueString("0"),
          accessible.accessibleValue,
          accessible.lockedValue
        )
      );
    }
  }

  const incrementDate = getDateIncrement(config.interval);
  let accumulatedValue = Decimal(currentValue);
  let totalContributions = 0;
  let totalBonuses = Decimal(0);
  let annualBonusUsage = new Map<string, BonusAnnualUsage>();

  const initialValue = createDecimalValueString(accumulatedValue.toString());
  const initialAccessible = calculateAccessibleValue(
    contributor,
    initialValue,
    effectiveStartDate,
    dateOfBirth
  );

  timePoints.push(
    createProjectionTimePoint(
      effectiveStartDate,
      initialValue,
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      false,
      createDecimalValueString("0"),
      initialAccessible.accessibleValue,
      initialAccessible.lockedValue
    )
  );

  const dateSequence = useCalendarGrid
    ? gridDates.slice(forwardStartIdx + 1).filter((d) => d <= config.endDate)
    : (function nextDates() {
        const out: Date[] = [];
        let prev = new Date(effectiveStartDate);
        while (prev < config.endDate) {
          const d = getNextProjectionDate(
            prev,
            incrementDate,
            config.endDate
          );
          out.push(new Date(d));
          prev = d;
        }
        return out;
      })();

  for (const currentProjectionDate of dateSequence) {
    if (currentProjectionDate > config.endDate) break;
    const previousDate =
      timePoints[timePoints.length - 1]?.date ?? effectiveStartDate;

    const yearsInInterval = calculateYearsElapsed(
      previousDate,
      currentProjectionDate
    );

    const effectiveGrowthRate = getEffectiveGrowthRate(contributor, config);
    const growthFactor =
      effectiveGrowthRate === 0
        ? 1
        : Math.pow(1 + effectiveGrowthRate / 100, yearsInInterval);
    let projectedValue = Decimal(accumulatedValue).mul(growthFactor);

    const periodResult = calculatePeriodContributions(
      contributor,
      previousDate,
      currentProjectionDate,
      modifierChain,
      createDecimalValueString(projectedValue.toString()),
      config.startDate,
      annualBonusUsage
    );

    const periodContributions = periodResult.contributions;
    const periodBonuses = Decimal(periodResult.bonuses);
    annualBonusUsage = periodResult.updatedAnnualUsage;

    totalContributions += periodContributions;
    totalBonuses = totalBonuses.add(periodBonuses);
    projectedValue = Decimal(projectedValue)
      .add(periodContributions)
      .add(periodBonuses);
    accumulatedValue = Decimal(projectedValue);

    const finalValue = applyModifiersToValue(
      createDecimalValueString(projectedValue.toString()),
      createDecimalValueString(projectedValue.toString()),
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    const accessible = calculateAccessibleValue(
      contributor,
      finalValue,
      currentProjectionDate,
      dateOfBirth
    );

    const previousPointValue = timePoints[timePoints.length - 1]?.value || "0";
    const growthAmount = Decimal(finalValue)
      .sub(Decimal(previousPointValue))
      .sub(Decimal(periodContributions))
      .toNumber();

    timePoints.push(
      createProjectionTimePoint(
        currentProjectionDate,
        finalValue,
        createDecimalValueString(Decimal(totalContributions).toString()),
        createDecimalValueString(Decimal(growthAmount).toString()),
        true,
        createDecimalValueString(totalBonuses.toString()),
        accessible.accessibleValue,
        accessible.lockedValue
      )
    );
  }

  return timePoints;
}

// ============================================================================
// MAIN PROJECTION FUNCTION
// ============================================================================

/**
 * Generate simple projection based on config
 */
export function generateSimpleProjection(
  input: SimpleProjectionInput
): SimpleProjectionResult {
  const timePoints =
    input.config.growthModel === "linear"
      ? generateLinearProjectionTimeSeries(input)
      : generateCompoundProjectionTimeSeries(input);

  const lastPoint = timePoints[timePoints.length - 1];
  const firstPoint = timePoints[0];

  if (!lastPoint || !firstPoint) {
    return {
      timePoints,
      totalGrowth: createDecimalValueString("0"),
      totalContributions: createDecimalValueString("0"),
      finalValue: input.currentValue,
    };
  }

  return {
    timePoints,
    totalGrowth: createDecimalValueString(
      Decimal(lastPoint.value)
        .sub(Decimal(firstPoint.value))
        .sub(Decimal(lastPoint.contributions))
        .toString()
    ),
    totalContributions: createDecimalValueString(
      Decimal(lastPoint.contributions).toString()
    ),
    finalValue: createDecimalValueString(Decimal(lastPoint.value).toString()),
  };
}

