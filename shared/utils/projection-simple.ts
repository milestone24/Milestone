import {
  SimpleProjectionConfigWithDateRange,
  ProjectionTimePoint,
  ContributorSchedule,
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

// ============================================================================
// SIMPLE PROJECTION SERVICE
// ============================================================================

/**
 * Input for simple projections
 */
export interface SimpleProjectionInput {
  currentValue: DecimalValueString;
  currentDate?: Date;
  //recurringContributions: RecurringContribution[];
  scheduledContributions: ContributorSchedule[];
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
  let totalGrowth = Decimal(0);

  // Initial point
  timePoints.push(
    createProjectionTimePoint(
      currentProjectionDate,
      accumulatedValue,
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      false // First point is current
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
    // this should be a float of two decimal places
    //This is still succeptable to rounding errors, and should be using decimal.js
    //config.growthRate is a a percentage but is represented as a integer, so we need to convert it to a decimal
    const growthRate = config.growthRate / 100;
    const growthValue = Decimal(currentValue)
      .mul(growthRate)
      .mul(yearsFromStart);

    // Calculate contributions in this period
    const lastTimePoint = timePoints[timePoints.length - 1];

    const periodContributions = calculatePeriodContributions(
      scheduledContributions,
      lastTimePoint ? lastTimePoint.date : config.startDate,
      currentProjectionDate,
      modifierChain,
      accumulatedValue,
      config.startDate
    );

    totalContributions = Decimal(totalContributions).add(periodContributions);
    totalGrowth = growthValue;
    accumulatedValue = createDecimalValueString(
      Decimal(currentValue).add(growthValue).add(totalContributions).toString()
    );

    // Apply modifiers to final value (inflation, fees)
    const finalValue = applyModifiersToValue(
      accumulatedValue,
      accumulatedValue,
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    const timePoint = createProjectionTimePoint(
      currentProjectionDate,
      finalValue,
      createDecimalValueString(Decimal(totalContributions).toString()),
      createDecimalValueString(Decimal(totalGrowth).toString()),
      true
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
    //recurringContributions,
    scheduledContributions,
    config,
    modifierChain,
  } = input;

  const timePoints: ProjectionTimePoint[] = [];
  const incrementDate = getDateIncrement(config.interval);

  let currentProjectionDate = new Date(config.startDate);
  let accumulatedValue = Decimal(currentValue);
  let totalContributions = 0;

  // Initial point
  timePoints.push(
    createProjectionTimePoint(
      currentProjectionDate,
      createDecimalValueString(accumulatedValue.toString()),
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      false
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

    // Calculate and add contributions in this period
    const periodContributions = calculatePeriodContributions(
      scheduledContributions,
      previousDate,
      currentProjectionDate,
      modifierChain,
      createDecimalValueString(projectedValue.toString()),
      config.startDate
    );

    totalContributions += periodContributions;
    projectedValue = Decimal(projectedValue).add(periodContributions);
    accumulatedValue = Decimal(projectedValue);

    // Apply modifiers to final value (inflation, fees)
    const finalValue = applyModifiersToValue(
      createDecimalValueString(projectedValue.toString()),
      createDecimalValueString(projectedValue.toString()),
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    const growthAmount = Decimal(finalValue)
      .sub(Decimal(timePoints[timePoints.length - 1]?.value || 0))
      .sub(Decimal(periodContributions))
      .toNumber();

    timePoints.push(
      createProjectionTimePoint(
        currentProjectionDate,
        finalValue,
        createDecimalValueString(Decimal(totalContributions).toString()),
        createDecimalValueString(Decimal(growthAmount).toString()),
        true
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
