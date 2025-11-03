/**
 * Client-side projection utilities
 * Lightweight calculations for interactive adjustments without server round-trips
 * Intended to work with projection data returned from the server
 */

import type {
  ProjectionTimePoint,
  SimpleProjectionConfigWithDateRange,
} from "../schema/projections";
import { ModifierChain, calculateYearsElapsed } from "./projection-modifiers";
import {
  calculatePeriodContributions,
  applyModifiersToValue,
  createProjectionTimePoint,
  getNextProjectionDate,
  projectRecurringContributions,
} from "./projection-utils";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import {
  generateSimpleProjection,
  SimpleProjectionInput,
} from "./projection-simple";
import { ContributorSchedule } from "../schema/projections";
import Decimal from "decimal.js";
import { createDecimalValueString, DecimalValueString } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export type FireProjectionData = {
  age: number;
  portfolio: DecimalValueString;
  target: DecimalValueString;
};

export type FireProjectionResult = {
  projectionData: FireProjectionData[];
  yearsToFire: number;
};

// ============================================================================
// CLIENT-SIDE PROJECTION CALCULATION
// ============================================================================
// NOTE: Projection computation is delegated to projection-simple.ts via
// the SimpleProjectionInput interface to avoid code duplication.
// This file focuses on client-specific utilities such as age-based
// conversions, FIRE calculations, and the ProjectionClient wrapper.

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
  targetAmount: DecimalValueString
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
      portfolio: createDecimalValueString(Decimal(point.value).toString()),
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
  presentValue: DecimalValueString,
  scheduledContributions: ContributorSchedule[],
  annualRate: number,
  targetValue: DecimalValueString,
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
    const totalContributionAmount = scheduledContributions.reduce(
      (sum, c) => Decimal(c.value).add(sum).toNumber(),
      0
    );
    if (totalContributionAmount === 0) return Infinity;
    return Decimal(targetValue)
      .sub(presentValue)
      .div(totalContributionAmount)
      .mul(12)
      .toNumber();
  }

  // Use iterative approach similar to tracking.ts
  let months = 0;
  let currentValue = presentValue;
  let currentDate = new Date(config.startDate);

  while (currentValue < targetValue && months < maxMonths) {
    // Apply growth
    currentValue = createDecimalValueString(
      Decimal(currentValue).mul(Decimal(1).add(monthlyRate)).toString()
    );

    // Add contributions for this month
    const nextMonth = addMonths(currentDate, 1);
    for (const contribution of scheduledContributions) {
      for (const { amount } of projectRecurringContributions(
        contribution,
        currentDate,
        nextMonth
      )) {
        currentValue = createDecimalValueString(
          Decimal(currentValue).add(amount).toString()
        );
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
  currentAmount: DecimalValueString,
  scheduledContributions: ContributorSchedule[],
  expectedReturn: number,
  targetAmount: DecimalValueString,
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
  const input: SimpleProjectionInput = {
    currentValue: currentAmount,
    currentDate: new Date(),
    scheduledContributions,
    config,
  };

  // Calculate projection using shared implementation
  const result = generateSimpleProjection(input);
  const timePoints = result.timePoints;

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
      portfolio: createDecimalValueString(
        Decimal(timePoint?.value || currentAmount)
          .round()
          .toString()
      ),
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
  currentAmount: DecimalValueString,
  currentScheduledContributions: ContributorSchedule[],
  newMonthlyContribution: DecimalValueString,
  expectedReturn: number,
  targetAmount: DecimalValueString,
  currentAge: number
): {
  originalYears: number;
  newYears: number;
  yearsDifference: number;
  monthsDifference: number;
} {
  // Create adjusted contributions list
  const adjustedContributions = currentScheduledContributions.map((c) => ({
    ...c,
    amount: newMonthlyContribution,
  }));

  const startDate = new Date();

  // Calculate years with current contributions
  const originalYears = calculateYearsToTarget(
    currentAmount,
    currentScheduledContributions,
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
  currentAmount: DecimalValueString,
  scheduledContributions: ContributorSchedule[],
  expectedReturn: number,
  fireNumber: DecimalValueString
): number {
  return calculateYearsToTarget(
    currentAmount,
    scheduledContributions,
    expectedReturn,
    fireNumber,
    { startDate: new Date() }
  );
}

// ============================================================================
// PROJECTION CLIENT WRAPPER
// ============================================================================

export type ProjectionClientState = {
  currentValue: DecimalValueString;
  scheduledContributions: ContributorSchedule[];
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

  getContributions(): ContributorSchedule[] {
    return this.state.scheduledContributions;
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

  setScheduledContributions(contributions: ContributorSchedule[]): this {
    this.state.scheduledContributions = contributions;
    return this;
  }

  updateContributionAmount(amount: number): this {
    this.state.scheduledContributions = this.state.scheduledContributions.map(
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

  setCurrentValue(currentValue: DecimalValueString): this {
    this.state.currentValue = createDecimalValueString(currentValue);
    return this;
  }

  compute(): ProjectionTimePoint[] {
    // Use the shared implementation from projection-simple.ts
    const input: SimpleProjectionInput = {
      currentValue: this.state.currentValue,
      currentDate: new Date(), // Not used in calculations but required by interface
      scheduledContributions: this.state.scheduledContributions,
      config: this.state.config,
      modifierChain: this.state.modifierChain,
    };

    const result = generateSimpleProjection(input);
    return result.timePoints;
  }
}
