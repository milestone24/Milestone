import type { RecurringContribution } from "@shared/schema";
import type { ProjectionTimePoint } from "@shared/schema/projections";
import { projectRecurringContributions } from "./projection-simple";
import { ModifierChain, createModifierContext } from "./projection-modifiers";

export const calculateAge = (dateOfBirth: Date) => {
  const today = new Date();
  const dob = new Date(dateOfBirth);

  let age = today.getFullYear() - dob.getFullYear();

  const monthDifference = today.getMonth() - dob.getMonth();

  // Adjust age if birthday hasn't occurred yet this year
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age;
};

// ============================================================================
// CONTRIBUTION CALCULATION HELPERS
// ============================================================================

/**
 * Calculate total contributions for a given period with modifier application
 */
export function calculatePeriodContributions(
  contributions: RecurringContribution[],
  startDate: Date,
  endDate: Date,
  modifierChain?: ModifierChain,
  currentValue: number = 0,
  projectionStartDate?: Date
): number {
  let totalContributions = 0;

  for (const contribution of contributions.filter((c) => c.isActive)) {
    for (const { date, amount } of projectRecurringContributions(
      contribution,
      startDate,
      endDate
    )) {
      let contributionAmount = amount;

      // Apply modifiers to contribution
      if (modifierChain && projectionStartDate) {
        const context = createModifierContext(
          currentValue,
          projectionStartDate,
          date,
          amount
        );
        contributionAmount = modifierChain.apply(amount, context);
      }

      totalContributions += contributionAmount;
    }
  }

  return totalContributions;
}

// ============================================================================
// MODIFIER APPLICATION HELPERS
// ============================================================================

/**
 * Apply modifiers to a value with proper context creation
 */
export function applyModifiersToValue(
  value: number,
  contextValue: number,
  projectionStartDate: Date,
  currentDate: Date,
  modifierChain?: ModifierChain,
  contributionAmount?: number
): number {
  if (!modifierChain) {
    return value;
  }

  const context = createModifierContext(
    contextValue,
    projectionStartDate,
    currentDate,
    contributionAmount
  );

  return modifierChain.apply(value, context);
}

// ============================================================================
// TIME POINT CREATION HELPERS
// ============================================================================

/**
 * Create a standardized projection time point
 */
export function createProjectionTimePoint(
  date: Date,
  value: number,
  contributions: number,
  growth: number,
  isProjected: boolean = true
): ProjectionTimePoint {
  return {
    date: new Date(date),
    value,
    contributions,
    growth,
    projectedValue: isProjected,
  };
}

// ============================================================================
// DATE ITERATION HELPERS
// ============================================================================

/**
 * Iterate through projection dates with proper boundary handling
 * Returns the next date or the end date if it exceeds the boundary
 */
export function getNextProjectionDate(
  currentDate: Date,
  incrementDate: (date: Date) => Date,
  endDate: Date
): Date {
  const nextDate = incrementDate(currentDate);

  if (nextDate > endDate) {
    return new Date(endDate);
  }

  return nextDate;
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

/**
 * Find the closest time point at or before a given date
 */
export function findTimePointAtOrBefore(
  timePoints: ProjectionTimePoint[],
  targetDate: Date
): ProjectionTimePoint | undefined {
  let closest: ProjectionTimePoint | undefined;

  for (const point of timePoints) {
    if (point.date <= targetDate) {
      if (!closest || point.date > closest.date) {
        closest = point;
      }
    }
  }

  return closest;
}

/**
 * Collect all unique dates from multiple time series and sort them
 */
export function extractAndSortDates(
  timeSeries: ProjectionTimePoint[][]
): Date[] {
  const datesSet = new Set<number>();

  for (const series of timeSeries) {
    for (const point of series) {
      datesSet.add(point.date.getTime());
    }
  }

  const sortedTimestamps = Array.from(datesSet).sort();

  return sortedTimestamps.map((timestamp) => new Date(timestamp));
}
