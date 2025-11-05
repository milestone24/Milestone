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
  const incrementDate = getDateIncrement(config.interval);

  let currentProjectionDate = new Date(config.startDate);
  let accumulatedValue = createDecimalValueString(
    Decimal(currentValue).toString()
  );
  let totalContributions = Decimal(0);
  let totalBonuses = Decimal(0);
  let totalGrowth = Decimal(0);
  let annualBonusUsage = new Map<string, BonusAnnualUsage>();

  // Initial point - calculate accessible value
  const initialAccessible = calculateAccessibleValue(
    contributor,
    accumulatedValue,
    currentProjectionDate,
    dateOfBirth
  );

  timePoints.push(
    createProjectionTimePoint(
      currentProjectionDate,
      accumulatedValue,
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      false, // First point is current
      createDecimalValueString("0"),
      initialAccessible.accessibleValue,
      initialAccessible.lockedValue
    )
  );

  // Generate points until end date
  while (currentProjectionDate < config.endDate) {
    currentProjectionDate = getNextProjectionDate(
      currentProjectionDate,
      incrementDate,
      config.endDate
    );

    // Calculate years elapsed from start
    const yearsFromStart = calculateYearsElapsed(
      config.startDate,
      currentProjectionDate
    );

    // Apply linear growth to initial value only
    const growthRate = config.growthRate / 100;
    const growthValue = Decimal(currentValue)
      .mul(growthRate)
      .mul(yearsFromStart);

    // Calculate contributions in this period (with bonuses)
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
    // Portfolio value = currentValue + growth + userContributions + bonuses
    accumulatedValue = createDecimalValueString(
      Decimal(currentValue)
        .add(growthValue)
        .add(totalContributions)
        .add(totalBonuses)
        .toString()
    );

    // Apply modifiers to final value (inflation, fees)
    const finalValue = applyModifiersToValue(
      accumulatedValue,
      accumulatedValue,
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    // Calculate accessible value at this time point
    const accessible = calculateAccessibleValue(
      contributor,
      finalValue,
      currentProjectionDate,
      dateOfBirth
    );

    const timePoint = createProjectionTimePoint(
      currentProjectionDate,
      finalValue,
      createDecimalValueString(Decimal(totalContributions).toString()),
      createDecimalValueString(Decimal(totalGrowth).toString()),
      true,
      createDecimalValueString(totalBonuses.toString()),
      accessible.accessibleValue,
      accessible.lockedValue
    );

    timePoints.push(timePoint);
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
  const incrementDate = getDateIncrement(config.interval);

  let currentProjectionDate = new Date(config.startDate);
  let accumulatedValue = Decimal(currentValue);
  let totalContributions = 0;
  let totalBonuses = Decimal(0);
  let annualBonusUsage = new Map<string, BonusAnnualUsage>();

  // Initial point - calculate accessible value
  const initialValue = createDecimalValueString(accumulatedValue.toString());
  const initialAccessible = calculateAccessibleValue(
    contributor,
    initialValue,
    currentProjectionDate,
    dateOfBirth
  );

  timePoints.push(
    createProjectionTimePoint(
      currentProjectionDate,
      initialValue,
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      false,
      createDecimalValueString("0"),
      initialAccessible.accessibleValue,
      initialAccessible.lockedValue
    )
  );

  // Generate points until end date
  while (currentProjectionDate < config.endDate) {
    const previousDate = new Date(currentProjectionDate);
    currentProjectionDate = getNextProjectionDate(
      currentProjectionDate,
      incrementDate,
      config.endDate
    );

    // Calculate time elapsed in this interval
    const yearsInInterval = calculateYearsElapsed(
      previousDate,
      currentProjectionDate
    );

    // Apply compound growth to accumulated value
    const growthFactor = Math.pow(1 + config.growthRate / 100, yearsInInterval);
    let projectedValue = Decimal(accumulatedValue).mul(growthFactor);

    // Calculate and add contributions in this period (with bonuses)
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
    // Add both user contributions and bonuses to portfolio value
    projectedValue = Decimal(projectedValue)
      .add(periodContributions)
      .add(periodBonuses);
    accumulatedValue = Decimal(projectedValue);

    // Apply modifiers to final value (inflation, fees)
    const finalValue = applyModifiersToValue(
      createDecimalValueString(projectedValue.toString()),
      createDecimalValueString(projectedValue.toString()),
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    // Calculate accessible value at this time point
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

