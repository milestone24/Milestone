import type {
  ProjectionTimePoint,
  ProjectionInterval,
  ContributorSchedule,
  Contributor,
  ProjectionConfigWithDateRange,
  SimpleProjectionConfigWithDateRange,
  ProjectionConfig,
  FireProjectionData,
  MonthlyContributionDifference,
} from "@shared/schema/projections";
import { ModifierChain, createModifierContext } from "./projection-modifiers";
import { getNextExecutionDate } from "./scheduling";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import {
  createDecimalValueString,
  DecimalValueString,
} from "@shared/schema";
import Decimal from "decimal.js";
import {
  applyBonusValuesToContribution,
  BonusAnnualUsage,
} from "./projection-bonus-calculator";

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
// RECURRING CONTRIBUTIONS
// ============================================================================

/**
 * Project future contribution dates based on schedule pattern
 */
export function* projectRecurringContributions(
  contribution: ContributorSchedule,
  startDate: Date,
  endDate: Date
): Generator<{ date: Date; amount: DecimalValueString }> {
  let currentDate =
    startDate > contribution.startDate ? startDate : contribution.startDate;

  while (currentDate <= endDate) {
    // Get next execution date
    const nextDate = getNextExecutionDate(
      contribution.patternConfig,
      startDate,
      currentDate,
      { includeCurrentDate: false, defaultTime: "midday" }
    );

    if (nextDate && nextDate <= endDate) {
      yield {
        date: new Date(nextDate),
        amount: contribution.value,
      };
    }

    if (!nextDate || nextDate > endDate) {
      break;
    }

    currentDate = nextDate;
  }
}

// ============================================================================
// CONTRIBUTION CALCULATION HELPERS
// ============================================================================

/**
 * Calculate total contributions for a given period with bonus and modifier application
 */
export function calculatePeriodContributions(
  contributor: Contributor,
  startDate: Date,
  endDate: Date,
  modifierChain?: ModifierChain,
  currentValue: DecimalValueString = createDecimalValueString("0"),
  projectionStartDate?: Date,
  annualBonusUsage?: Map<string, BonusAnnualUsage>
): {
  contributions: number;
  bonuses: DecimalValueString;
  updatedAnnualUsage: Map<string, BonusAnnualUsage>;
} {
  let totalContributions = 0;
  let totalBonuses = Decimal(0);
  let updatedUsage = annualBonusUsage || new Map<string, BonusAnnualUsage>();

  for (const contribution of contributor.schedules) {
    for (const { date, amount } of projectRecurringContributions(
      contribution,
      startDate,
      endDate
    )) {
      // Track original user contribution separately from bonuses
      const userContribution = amount;
      let contributionWithBonuses = amount;
      let bonusAmount = Decimal(0);

      // Apply bonus values if any
      if (contributor.bonusValues && contributor.bonusValues.length > 0) {
        const bonusResult = applyBonusValuesToContribution(
          amount,
          contributor.bonusValues,
          date,
          updatedUsage
        );
        contributionWithBonuses = bonusResult.totalContribution;
        bonusAmount = Decimal(bonusResult.totalBonus);
        totalBonuses = totalBonuses.add(bonusAmount);
        updatedUsage = bonusResult.updatedAnnualUsage;
      }

      // Apply modifiers to contribution (user contribution + bonuses combined)
      // Modifiers should be applied to the total amount that goes into the portfolio
      let contributionAmountForModifiers = contributionWithBonuses;
      if (modifierChain && projectionStartDate) {
        const context = createModifierContext(
          currentValue,
          projectionStartDate,
          date,
          contributionAmountForModifiers
        );
        contributionAmountForModifiers = modifierChain.apply(
          contributionAmountForModifiers,
          context
        );
      }

      // Track user contributions separately (user money only, excluding bonuses)
      // Apply modifiers proportionally to both user contributions and bonuses
      // This ensures the sum of modified user contributions + modified bonuses = modified total
      // Note: Contribution-level modifiers (like tax) are applied here proportionally
      // Portfolio-level modifiers (like inflation) are applied later in projection-simple.ts
      const modifierRatio =
        contributionWithBonuses === "0" ||
        Decimal(contributionWithBonuses).eq(0)
          ? Decimal(1)
          : Decimal(contributionAmountForModifiers).div(
              contributionWithBonuses
            );

      // Apply modifiers proportionally to user contribution
      const userContributionAfterModifiers = Decimal(userContribution)
        .mul(modifierRatio)
        .toNumber();

      // Apply modifiers proportionally to bonus as well
      // The bonus portion that goes into portfolio = bonus * modifierRatio
      const bonusAfterModifiers = bonusAmount.mul(modifierRatio);

      totalContributions = Decimal(totalContributions)
        .add(userContributionAfterModifiers)
        .toNumber();

      // Track bonuses with modifiers applied (for portfolio value calculation)
      // Note: We track the modified bonus amount so that when added to portfolio,
      // the sum of userContributions + bonuses equals the modified total
      totalBonuses = totalBonuses.add(bonusAfterModifiers);
    }
  }

  return {
    contributions: totalContributions,
    bonuses: createDecimalValueString(totalBonuses.toString()),
    updatedAnnualUsage: updatedUsage,
  };
}

// ============================================================================
// GROWTH RATE RESOLUTION
// ============================================================================

/**
 * Get effective growth rate for a contributor based on projection config
 *
 * Global Mode (useContributorSpecificGrowthRates = false):
 * - All contributors use config.growthRate
 * - Exception: If contributor.expectedGrowthRate is undefined or 0, that contributor gets 0% growth (opt-out)
 * - Any other value on contributor.expectedGrowthRate is ignored
 *
 * Contributor Mode (useContributorSpecificGrowthRates = true):
 * - Each contributor uses its own expectedGrowthRate
 * - undefined = 0 (no growth)
 *
 * @param contributor - The contributor to get growth rate for
 * @param config - The projection configuration
 * @returns The effective growth rate to use (as percentage, e.g., 7 for 7%)
 */
export function getEffectiveGrowthRate(
  contributor: Contributor,
  config: SimpleProjectionConfigWithDateRange
): number {
  if (config.useContributorSpecificGrowthRates ?? false) {
    // Contributor mode: use contributor's own rate
    // undefined = 0 (no growth)
    return contributor.expectedGrowthRate ?? 0;
  }

  // Non-contributor mode: use global rate
  // BUT: undefined or 0 on contributor = opt-out flag (no growth)
  if (
    contributor.expectedGrowthRate === undefined ||
    contributor.expectedGrowthRate === 0
  ) {
    return 0; // Excluded from growth
  }

  // Contributor has a non-zero rate set
  // In non-contributor mode, IGNORE it and use global
  return config.growthRate;
}

// ============================================================================
// MODIFIER APPLICATION HELPERS
// ============================================================================

/**
 * Apply modifiers to a value with proper context creation
 */
export function applyModifiersToValue(
  value: DecimalValueString,
  contextValue: DecimalValueString,
  projectionStartDate: Date,
  currentDate: Date,
  modifierChain?: ModifierChain,
  contributionAmount?: DecimalValueString
): DecimalValueString {
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
  value: DecimalValueString,
  contributions: DecimalValueString,
  growth: DecimalValueString,
  isProjected: boolean = true,
  bonuses?: DecimalValueString,
  accessibleValue?: DecimalValueString,
  lockedValue?: DecimalValueString
): ProjectionTimePoint {
  return {
    date: new Date(date),
    value,
    contributions,
    growth,
    bonuses,
    accessibleValue,
    lockedValue,
    projectedValue: isProjected,
  };
}

// ============================================================================
// DATE ITERATION HELPERS
// ============================================================================

/**
 * Get date incrementor function based on interval
 */
export function getDateIncrement(
  interval: ProjectionInterval
): (date: Date) => Date {
  switch (interval) {
    case "daily":
      return (date) => addDays(date, 1);
    case "weekly":
      return (date) => addWeeks(date, 1);
    case "monthly":
      return (date) => addMonths(date, 1);
    case "yearly":
      return (date) => addYears(date, 1);
  }
}

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

//TODO Correct spelling of range
export function addDateRengeToProjectionConfig(
  projectionConfig: ProjectionConfig,
  startDate: Date,
  endDate: Date
): ProjectionConfigWithDateRange {
  return {
    ...projectionConfig,
    startDate,
    endDate,
  };
}

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
      accessibleValue: point.accessibleValue
        ? createDecimalValueString(Decimal(point.accessibleValue).toString())
        : undefined,
      lockedValue: point.lockedValue
        ? createDecimalValueString(Decimal(point.lockedValue).toString())
        : undefined,
    });
  }

  return projectionData;
}

/**
 * Calculate additional monthly contribution needed to reach milestone*
 * TODO: This method should now return a positive or negative number depending on whether the user is ahead or behind the target
 * TODO: This method should consider if the current value exceeds the target.
 */
export function calculateMonthlyContributionDifference(
  contributors: Contributor[],
  totalTargetDifference: number,
  monthsRemaining: number,
  annualGrowthRate: number
): MonthlyContributionDifference {

  //First get an average monthly contribution from the contributors
  //Contributors can have random schedules of any freqquncy.
  //So we should first calculate an estimate of what they would contribute in a year
  //And then divide by 12 to get a monthly contribution
  //What happens for contributors with a limited duration, say only twice a month for 6 months?
  const startDate = new Date();
  const oneYearFromNow = addYears(startDate, 1);

  let totalAnnualUserContributions = Decimal(0);
  let totalAnnualBonuses = Decimal(0);

  // Calculate total annual contributions from all contributors
  // This estimates monthly average by projecting one year ahead
  for (const contributor of contributors) {
    const periodResult = calculatePeriodContributions(
      contributor,
      startDate,
      oneYearFromNow
    );
    totalAnnualUserContributions = totalAnnualUserContributions.add(
      periodResult.contributions
    );
    totalAnnualBonuses = totalAnnualBonuses.add(periodResult.bonuses);
  }

  // Calculate existing monthly contributions
  // approximateMonthlyContribution should be user contributions only (no bonuses)
  const approximateMonthlyContribution = totalAnnualUserContributions.div(12);

  // Calculate existing total monthly contribution (user + bonuses) for adjustment calculation
  // Bonuses are considered when calculating what's needed, but not included in returned values
  const existingTotalMonthlyContribution = totalAnnualUserContributions
    .add(totalAnnualBonuses)
    .div(12);

  // Handle edge cases: if no months remaining or target already reached,
  // all contributions are excess (over-investing)
  if (monthsRemaining <= 0) {
    // If we still have contributions but no months left to target,
    // all contributions are excess (positive difference = over-investing)
    return {
      approximateMonthlyContribution: createDecimalValueString(
        approximateMonthlyContribution.toFixed(2)
      ),
      monthlyContributionDifference: createDecimalValueString(
        approximateMonthlyContribution.toFixed(2)
      ),
    };
  }

  // If we have already reached the target, all contributions are excess
  if (totalTargetDifference === 0) {
    return {
      approximateMonthlyContribution: createDecimalValueString(
        approximateMonthlyContribution.toFixed(2)
      ),
      monthlyContributionDifference: createDecimalValueString(
        approximateMonthlyContribution.toFixed(2)
      ),
    };
  }

  // Calculate what monthly contribution is needed to close the gap
  // Using future value of annuity formula solved for payment:
  // FV = PMT × [((1 + r)^n - 1) / r]
  // PMT = FV / [((1 + r)^n - 1) / r]
  //
  // totalTargetDifference = projectedValueAtRetirement - fireNumber
  // Negative totalTargetDifference = below target (shortfall) = need more contributions
  // Positive totalTargetDifference = exceeds target (over-invested) = can reduce contributions
  //
  // To close the gap, we need monthly contributions that will grow to equal -totalTargetDifference
  // (negate to close the gap, not create it)

  const monthlyRate = Decimal(annualGrowthRate).div(100).div(12);

  let adjustmentMonthlyContribution: Decimal;

  if (monthlyRate.eq(0)) {
    // No growth, simple division
    // To close gap: negative totalTargetDifference (shortfall) needs positive adjustment
    //              positive totalTargetDifference (overage) needs negative adjustment
    adjustmentMonthlyContribution = Decimal(totalTargetDifference)
      .neg()
      .div(monthsRemaining);
  } else {
    const futureValueFactor = Decimal(1)
      .add(monthlyRate)
      .pow(monthsRemaining)
      .sub(1)
      .div(monthlyRate);

    // Calculate what monthly contribution adjustment is needed to close the gap
    // Negate totalTargetDifference because we want to close the gap, not create it
    // Negative totalTargetDifference (shortfall) → positive adjustment (need more)
    // Positive totalTargetDifference (overage) → negative adjustment (can reduce)
    adjustmentMonthlyContribution = Decimal(totalTargetDifference)
      .neg()
      .div(futureValueFactor);
  }

  // Calculate the total monthly contribution needed to reach the target (including bonuses)
  // Total needed = existing total (user + bonuses) + adjustment
  const totalNeededMonthlyContribution = existingTotalMonthlyContribution.add(
    adjustmentMonthlyContribution
  );

  // Calculate the ratio of user contributions to total (user + bonuses)
  // This helps us determine what user contribution portion is needed
  const userContributionRatio = existingTotalMonthlyContribution.eq(0)
    ? Decimal(1) // If no existing contributions, assume 100% user (no bonuses)
    : approximateMonthlyContribution.div(existingTotalMonthlyContribution);

  // Calculate needed user contribution (excluding bonuses)
  // Apply the same ratio to the total needed
  const neededUserMonthlyContribution = totalNeededMonthlyContribution.mul(
    userContributionRatio
  );

  // Calculate the difference: existing user contributions - needed user contributions
  // Positive = contributing more than needed (over-investing)
  // Negative = contributing less than needed (under-investing)
  const monthlyContributionDifference = neededUserMonthlyContribution.sub(
    approximateMonthlyContribution
  );

  return {
    approximateMonthlyContribution: createDecimalValueString(
      approximateMonthlyContribution.toFixed(2)
    ),
    monthlyContributionDifference: createDecimalValueString(
      monthlyContributionDifference.toFixed(2)
    ),
  };
}

/**
 * Calculate years ahead or behind target retirement age
 * Uses calculateYearsToTarget to determine when portfolio will reach target,
 * then compares to target retirement age
 * 
 * @param currentPortfolioValue - Current portfolio value
 * @param targetValue - Target value (FIRE number)
 * @param scheduledContributions - Array of contribution schedules
 * @param annualGrowthRate - Annual growth rate as percentage (e.g., 7 for 7%)
 * @param targetRetirementAge - Target retirement age
 * @param currentAge - Current age
 * @returns Negative if ahead of schedule, positive if behind, 0 if on track, Infinity if unreachable
 */
export function calculateYearsAheadOrBehind(
  yearsToReachTarget: number,
  targetRetirementAge: number,
  currentAge: number
): number {
  // Calculate how many years it will take to reach the target

  // If it's impossible to reach the target, return Infinity
  if (yearsToReachTarget === Infinity) {
    return Infinity;
  }

  // Calculate years until target retirement age
  const yearsUntilTargetRetirement = targetRetirementAge - currentAge;

  // Calculate difference: negative = ahead, positive = behind, 0 = on track
  return yearsToReachTarget - yearsUntilTargetRetirement;
}

// ============================================================================
// FIRE PROJECTION CONVERSION
// ============================================================================

/**
 * Calculate years to reach target using client-side computation
 * Similar to tracking.ts calculateYearsToTarget but uses projection system
 */
export function calculateYearsToTarget(
  presentValue: DecimalValueString,
  contributors: Contributor[],
  annualRate: number,
  targetValue: DecimalValueString,
  modifierChain: ModifierChain,
  config: {
    startDate: Date;
    maxYears?: number;
  }
): number {
  const monthlyRate = annualRate / 100 / 12;
  const maxYears = config.maxYears || 100;
  const maxMonths = maxYears * 12;

  const scheduledContributions = contributors.flatMap(c => c.schedules);

  // Handle edge cases
  if (Decimal(presentValue).gte(targetValue)) return 0;
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

  while (Decimal(currentValue).lt(targetValue) && months < maxMonths) {
    // Apply growth
    currentValue = createDecimalValueString(
      Decimal(currentValue).mul(Decimal(1).add(monthlyRate)).toString()
    );

    // Add contributions for this month
    const nextMonth = addMonths(currentDate, 1);

    for (const contributor of contributors) {

      const { contributions } = calculatePeriodContributions(contributor, currentDate, nextMonth, modifierChain, currentValue, currentDate);

      currentValue = createDecimalValueString(
        Decimal(currentValue).add(contributions).toString()
      );

    }

    currentDate = nextMonth;
    months++;
  }

  return months / 12;
}

export const defineStatePensionAgeForGenderUK = (
  dateOfBirth: Date,
): number => {
  return dateOfBirth.getFullYear() < 1960
      ? 66
    : 67
};

export const defineStatePensionDetailsUK = (
  dateOfBirth: Date,
): {
  age: number;
  startDate: Date;
  } => {
  const statePensionAge = defineStatePensionAgeForGenderUK(dateOfBirth);
  return {
    age: statePensionAge,
    startDate: addYears(dateOfBirth, statePensionAge),
  };
};
