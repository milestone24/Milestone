/**
 * Client-side projection utilities
 * 
 * IMPORTANT: These utilities are for PREVIEW/WHAT-IF calculations only.
 * The server is the single source of truth for all authoritative projections.
 * 
 * Use cases:
 * - Quick previews when adjusting contribution amounts
 * - "What-if" scenario calculations
 * - Interactive adjustments without server round-trips
 * 
 * DO NOT use for:
 * - Main chart displays (use server projectionResult.timePoints)
 * - Authoritative calculations (always use server)
 * - Final projections (always use server)
 * 
 * The server handles:
 * - Bonuses (e.g., LISA 25% government bonus)
 * - Value releases (age/date-based access restrictions)
 * - Account-specific modifiers (tax, fees, inflation)
 * - Accurate compound growth with proper precision
 */

import type {
  FireProjectionData,
  ProjectionTimePoint,
  SimpleProjectionConfigWithDateRange,
  Contributor,
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
import { calculateYearsToTarget } from "./projection-utils";

// ============================================================================
// CLIENT-SIDE PROJECTION CALCULATION
// ============================================================================
// NOTE: Projection computation is delegated to projection-simple.ts via
// the SimpleProjectionInput interface to avoid code duplication.
// This file focuses on client-specific utilities such as age-based
// conversions, FIRE calculations, and the ProjectionClient wrapper.

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
    useContributorSpecificGrowthRates: false,
  };

  // Create minimal contributor for client-side projection (no bonuses/releases)
  const contributor: Contributor = {
    name: "Client Projection",
    accountType: "GIA", // Default account type
    type: "asset",
    currentValue: currentAmount,
    schedules: scheduledContributions,
    valueReleases: [],
    bonusValues: [],
  };

  // Create input for projection
  const input: SimpleProjectionInput = {
    currentValue: currentAmount,
    currentDate: new Date(),
    scheduledContributions,
    contributor,
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
 *
 * Accepts Contributor[] to preserve bonuses and value releases,
 * but extracts schedules for impact calculation.
 * For preview calculations, bonuses and value releases are already
 * reflected in the currentAmount from server calculations.
 */
export function calculateContributionImpactWithProjections(
  currentAmount: DecimalValueString,
  contributors: Contributor[],
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
  // Extract schedules from contributors (preserving bonuses and value releases in the model)
  // For impact calculations, we adjust the user contribution amounts
  const currentScheduledContributions = contributors.flatMap(
    (c) => c.schedules
  );

  // Create adjusted contributions list with new monthly contribution
  // Note: Bonuses will still apply to the adjusted amount (if configured in contributors)
  const adjustedContributions = currentScheduledContributions.map((c) => ({
    ...c,
    value: newMonthlyContribution,
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
    // Create minimal contributor for client-side projection (no bonuses/releases)
    const contributor: Contributor = {
      name: "Client Projection",
      accountType: "GIA", // Default account type
      type: "asset",
      currentValue: this.state.currentValue,
      schedules: this.state.scheduledContributions,
      valueReleases: [],
      bonusValues: [],
    };

    // Use the shared implementation from projection-simple.ts
    const input: SimpleProjectionInput = {
      currentValue: this.state.currentValue,
      currentDate: new Date(), // Not used in calculations but required by interface
      scheduledContributions: this.state.scheduledContributions,
      contributor,
      config: this.state.config,
      modifierChain: this.state.modifierChain,
    };

    const result = generateSimpleProjection(input);
    return result.timePoints;
  }
}
