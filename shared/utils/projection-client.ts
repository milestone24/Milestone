/**
 * Client-side projection utilities
 * Lightweight calculations for interactive adjustments without server round-trips
 * Intended to work with projection data returned from the server
 */

import type {
  ProjectionTimePoint,
  SimpleProjectionConfigWithDateRange,
} from "../schema/projections";
import type { RecurringContribution } from "../schema/transaction";
import { ModifierChain, calculateYearsElapsed } from "./projection-modifiers";
import {
  calculatePeriodContributions,
  applyModifiersToValue,
  createProjectionTimePoint,
  getNextProjectionDate,
  projectRecurringContributions,
} from "./projection-utils";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type FireProjectionData = {
  age: number;
  portfolio: number;
  target: number;
};

export type FireProjectionResult = {
  projectionData: FireProjectionData[];
  yearsToFire: number;
};

/**
 * Simplified input for client-side projections
 * Works with data already fetched from server
 */
export interface ClientProjectionInput {
  currentValue: number;
  recurringContributions: RecurringContribution[];
  config: SimpleProjectionConfigWithDateRange;
  modifierChain?: ModifierChain;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get date incrementor function based on interval
 */
function getDateIncrement(interval: "daily" | "weekly" | "monthly" | "yearly") {
  switch (interval) {
    case "daily":
      return (date: Date) => addDays(date, 1);
    case "weekly":
      return (date: Date) => addWeeks(date, 1);
    case "monthly":
      return (date: Date) => addMonths(date, 1);
    case "yearly":
      return (date: Date) => addYears(date, 1);
  }
}

// ============================================================================
// CLIENT-SIDE PROJECTION CALCULATION
// ============================================================================

/**
 * Generate compound growth projection on the client side
 * Uses same logic as server but optimized for browser
 */
export function computeCompoundProjection(
  input: ClientProjectionInput
): ProjectionTimePoint[] {
  const { currentValue, recurringContributions, config, modifierChain } = input;

  const timePoints: ProjectionTimePoint[] = [];
  const incrementDate = getDateIncrement(config.interval);

  let currentProjectionDate = new Date(config.startDate);
  let accumulatedValue = currentValue;
  let totalContributions = 0;

  // Initial point
  timePoints.push(
    createProjectionTimePoint(
      currentProjectionDate,
      accumulatedValue,
      0,
      0,
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
    let projectedValue = accumulatedValue * growthFactor;

    // Calculate and add contributions in this period
    const periodContributions = calculatePeriodContributions(
      recurringContributions,
      previousDate,
      currentProjectionDate,
      modifierChain,
      projectedValue,
      config.startDate
    );

    totalContributions += periodContributions;
    projectedValue += periodContributions;
    accumulatedValue = projectedValue;

    // Apply modifiers to final value (inflation, fees)
    const finalValue = applyModifiersToValue(
      projectedValue,
      projectedValue,
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    const growthAmount =
      finalValue -
      (timePoints[timePoints.length - 1]?.value || 0) -
      periodContributions;

    timePoints.push(
      createProjectionTimePoint(
        currentProjectionDate,
        finalValue,
        totalContributions,
        growthAmount,
        true
      )
    );
  }

  return timePoints;
}

// ============================================================================
// LINEAR PROJECTION (for comparison/target scenarios)
// ============================================================================

/**
 * Generate linear growth projection on client side
 * Useful for conservative estimates or comparison scenarios
 */
export function computeLinearProjection(
  input: ClientProjectionInput
): ProjectionTimePoint[] {
  const { currentValue, recurringContributions, config, modifierChain } = input;

  const timePoints: ProjectionTimePoint[] = [];
  const incrementDate = getDateIncrement(config.interval);

  let currentProjectionDate = new Date(config.startDate);
  let accumulatedValue = currentValue;
  let totalContributions = 0;
  let totalGrowth = 0;

  // Initial point
  timePoints.push(
    createProjectionTimePoint(
      currentProjectionDate,
      accumulatedValue,
      0,
      0,
      false
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
    const growthValue =
      currentValue * (config.growthRate / 100) * yearsFromStart;

    // Calculate contributions in this period
    const lastTimePoint = timePoints[timePoints.length - 1];
    const periodContributions = calculatePeriodContributions(
      recurringContributions,
      lastTimePoint ? lastTimePoint.date : config.startDate,
      currentProjectionDate,
      modifierChain,
      accumulatedValue,
      config.startDate
    );

    totalContributions += periodContributions;
    totalGrowth = growthValue;
    accumulatedValue = currentValue + growthValue + totalContributions;

    // Apply modifiers to final value (inflation, fees)
    const finalValue = applyModifiersToValue(
      accumulatedValue,
      accumulatedValue,
      config.startDate,
      currentProjectionDate,
      modifierChain
    );

    timePoints.push(
      createProjectionTimePoint(
        currentProjectionDate,
        finalValue,
        totalContributions,
        totalGrowth,
        true
      )
    );
  }

  return timePoints;
}

// ============================================================================
// FIRE PROJECTION CONVERSION
// ============================================================================

/**
 * Convert date-based projection to age-based for FIRE charts
 * Takes ProjectionTimePoint[] from server and converts to FireProjectionData[]
 */
export function convertToAgeBasedProjection(
  timePoints: ProjectionTimePoint[],
  dateOfBirth: Date,
  targetAmount: number
): FireProjectionData[] {
  const projectionData: FireProjectionData[] = [];

  for (const point of timePoints) {
    // Calculate age at this point in time
    const birthYear = dateOfBirth.getFullYear();
    const pointYear = point.date.getFullYear();
    const birthMonth = dateOfBirth.getMonth();
    const pointMonth = point.date.getMonth();
    const birthDay = dateOfBirth.getDate();
    const pointDay = point.date.getDate();

    // Calculate age
    let age = pointYear - birthYear;
    if (
      pointMonth < birthMonth ||
      (pointMonth === birthMonth && pointDay < birthDay)
    ) {
      age--;
    }

    projectionData.push({
      age: Math.max(0, age),
      portfolio: Math.round(point.value),
      target: targetAmount,
    });
  }

  return projectionData;
}

/**
 * Calculate years to reach target using client-side computation
 * Similar to tracking.ts calculateYearsToTarget but uses projection system
 */
export function calculateYearsToTarget(
  presentValue: number,
  recurringContributions: RecurringContribution[],
  annualRate: number,
  targetValue: number,
  config: {
    startDate: Date;
    maxYears?: number;
  }
): number {
  const monthlyRate = annualRate / 100 / 12;
  const maxYears = config.maxYears || 100;
  const maxMonths = maxYears * 12;

  // Handle edge cases
  if (presentValue >= targetValue) return 0;
  if (monthlyRate === 0) {
    // No growth, calculate based on contributions only
    const totalContributionAmount = recurringContributions.reduce(
      (sum, c) => sum + (c.isActive ? c.amount : 0),
      0
    );
    if (totalContributionAmount === 0) return Infinity;
    return (targetValue - presentValue) / (totalContributionAmount * 12);
  }

  // Use iterative approach similar to tracking.ts
  let months = 0;
  let currentValue = presentValue;
  let currentDate = new Date(config.startDate);

  while (currentValue < targetValue && months < maxMonths) {
    // Apply growth
    currentValue = currentValue * (1 + monthlyRate);

    // Add contributions for this month
    const nextMonth = addMonths(currentDate, 1);
    for (const contribution of recurringContributions.filter(
      (c) => c.isActive
    )) {
      for (const { amount } of projectRecurringContributions(
        contribution,
        currentDate,
        nextMonth
      )) {
        currentValue += amount;
      }
    }

    currentDate = nextMonth;
    months++;
  }

  return months / 12;
}

// ============================================================================
// CLIENT-SIDE FIRE PROJECTION
// ============================================================================

/**
 * Calculate client-side FIRE projection
 * Replaces tracking.ts calculateFireProjection with unified projection system
 */
export function computeClientFireProjection(
  currentAmount: number,
  recurringContributions: RecurringContribution[],
  expectedReturn: number,
  targetAmount: number,
  currentAge: number,
  maxAge: number = 87
): FireProjectionData[] {
  const endAge = maxAge;
  const yearsToCalculate = endAge - currentAge;

  if (yearsToCalculate <= 0) {
    return [
      { age: currentAge, portfolio: currentAmount, target: targetAmount },
    ];
  }

  // Create config for annual projection
  const startDate = new Date();
  const endDate = addMonths(startDate, yearsToCalculate * 12);

  const config: SimpleProjectionConfigWithDateRange = {
    mode: "simple",
    growthRate: expectedReturn,
    growthModel: "compound",
    interval: "yearly",
    startDate,
    endDate,
    modifiers: [],
  };

  // Create input for projection
  const input: ClientProjectionInput = {
    currentValue: currentAmount,
    recurringContributions,
    config,
  };

  // Calculate projection
  const timePoints = computeCompoundProjection(input);

  // Convert to age-based format for charts
  const projectionData: FireProjectionData[] = [];

  for (let year = 0; year <= yearsToCalculate; year++) {
    const age = currentAge + year;

    // Find closest time point for this age
    const targetDate = addMonths(startDate, year * 12);
    const timePoint =
      timePoints.find(
        (p) =>
          Math.abs(p.date.getTime() - targetDate.getTime()) <
          30 * 24 * 60 * 60 * 1000 // Within 30 days
      ) || timePoints[Math.min(year, timePoints.length - 1)];

    projectionData.push({
      age,
      portfolio: Math.round(timePoint?.value || currentAmount),
      target: targetAmount,
    });
  }

  return projectionData;
}

// ============================================================================
// CONTRIBUTION IMPACT CALCULATION
// ============================================================================

/**
 * Calculate the impact of changing contribution amounts
 * Replaces tracking.ts calculateContributionImpact with projection system
 */
export function calculateContributionImpactWithProjections(
  currentAmount: number,
  currentRecurringContributions: RecurringContribution[],
  newMonthlyContribution: number,
  expectedReturn: number,
  targetAmount: number,
  currentAge: number
): {
  originalYears: number;
  newYears: number;
  yearsDifference: number;
  monthsDifference: number;
} {
  // Create adjusted contributions list
  const adjustedContributions = currentRecurringContributions.map((c) => ({
    ...c,
    amount: newMonthlyContribution,
  }));

  const startDate = new Date();

  // Calculate years with current contributions
  const originalYears = calculateYearsToTarget(
    currentAmount,
    currentRecurringContributions,
    expectedReturn,
    targetAmount,
    { startDate }
  );

  // Calculate years with new contributions
  const newYears = calculateYearsToTarget(
    currentAmount,
    adjustedContributions,
    expectedReturn,
    targetAmount,
    { startDate }
  );

  const yearsDifference = originalYears - newYears;
  const monthsDifference = Math.round(yearsDifference * 12);

  return {
    originalYears,
    newYears,
    yearsDifference,
    monthsDifference,
  };
}

// ============================================================================
// UTILITY: GET YEARS TO FIRE
// ============================================================================

/**
 * Calculate years until reaching FIRE target
 */
export function calculateYearsToFire(
  currentAmount: number,
  recurringContributions: RecurringContribution[],
  expectedReturn: number,
  fireNumber: number
): number {
  return calculateYearsToTarget(
    currentAmount,
    recurringContributions,
    expectedReturn,
    fireNumber,
    { startDate: new Date() }
  );
}

// ============================================================================
// PROJECTION CLIENT WRAPPER
// ============================================================================

export type ProjectionClientState = {
  currentValue: number;
  recurringContributions: RecurringContribution[];
  config: SimpleProjectionConfigWithDateRange;
  modifierChain?: ModifierChain;
};

export class ProjectionClient {
  private state: ProjectionClientState;

  constructor(initial: ProjectionClientState) {
    this.state = { ...initial };
  }

  getConfig(): SimpleProjectionConfigWithDateRange {
    return this.state.config;
  }

  getContributions(): RecurringContribution[] {
    return this.state.recurringContributions;
  }

  setGrowthRate(growthRate: number): this {
    this.state.config = { ...this.state.config, growthRate };
    return this;
  }

  setGrowthModel(growthModel: "linear" | "compound"): this {
    this.state.config = {
      ...this.state.config,
      growthModel,
    } as SimpleProjectionConfigWithDateRange;
    return this;
  }

  setEndDate(endDate: Date): this {
    this.state.config = { ...this.state.config, endDate };
    return this;
  }

  setStartDate(startDate: Date): this {
    this.state.config = { ...this.state.config, startDate };
    return this;
  }

  setRecurringContributions(contributions: RecurringContribution[]): this {
    this.state.recurringContributions = contributions;
    return this;
  }

  updateContributionAmount(amount: number): this {
    this.state.recurringContributions = this.state.recurringContributions.map(
      (c) => ({
        ...c,
        amount,
      })
    );
    return this;
  }

  setModifierChain(modifierChain?: ModifierChain): this {
    this.state.modifierChain = modifierChain;
    return this;
  }

  setCurrentValue(currentValue: number): this {
    this.state.currentValue = currentValue;
    return this;
  }

  compute(): ProjectionTimePoint[] {
    const { config } = this.state;
    if (config.growthModel === "linear") {
      return computeLinearProjection({
        currentValue: this.state.currentValue,
        recurringContributions: this.state.recurringContributions,
        config: this.state.config,
        modifierChain: this.state.modifierChain,
      });
    }
    return computeCompoundProjection({
      currentValue: this.state.currentValue,
      recurringContributions: this.state.recurringContributions,
      config: this.state.config,
      modifierChain: this.state.modifierChain,
    });
  }
}
