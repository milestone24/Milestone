import type {
  ProjectionTimePoint,
  ProjectionInterval,
  ContributorSchedule,
  ProjectionOrchestratorAssetInput,
  Contributor,
  ProjectionConfigWithDateRange,
  SimpleProjectionConfigWithDateRange,
  ProjectionConfig,
  FireProjectionData,
  BonusValue,
  ValueReleasePointInTime,
} from "@shared/schema/projections";
import { ModifierChain, createModifierContext } from "./projection-modifiers";
import { getNextExecutionDate } from "./scheduling";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import {
  AccountType,
  createDecimalValueString,
  DecimalValueString,
  RecurringContribution,
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

export function mapRecurringContributionToContributorSchedule(
  recurringContribution: RecurringContribution
): ContributorSchedule {
  return {
    patternConfig: recurringContribution.patternConfig,
    value: recurringContribution.amount,
    startDate: recurringContribution.startDate,
    endDate: null,
  };
}

export function mapRecurringContributionsToContributorSchedules(
  recurringContributions: RecurringContribution[]
): ContributorSchedule[] {
  return recurringContributions.map(
    mapRecurringContributionToContributorSchedule
  );
}

function defineBonusValuesForAssetType(assetType: AccountType): BonusValue[] {
  switch (assetType) {
    case "LISA":
      return [
        {
          name: "LISA",
          valueType: "percentage",
          value: createDecimalValueString("0.25"), // 25% government bonus
          annualLimit: createDecimalValueString("1000"), // Max bonus: 25% of £4,000 = £1,000
          annualContributionLimit: createDecimalValueString("4000"), // Max contributions eligible for bonus
          priority: 1,
        },
      ];
    case "ISA":
    case "CISA":
    case "SIPP":
    case "GIA":
      // No government bonuses for these account types
      return [];
    default:
      return [];
  }
}

function defineValueReleasePointsForAssetType(
  assetType: AccountType
): ValueReleasePointInTime[] {
  switch (assetType) {
    case "LISA":
      // Lifetime ISA: Age 60+ (no penalty), or early withdrawal with 25% penalty
      // Exceptions: first home purchase, terminal illness
      return [
        {
          value: "60", // Age 60 or over
          valueType: "age",
          penalties: [
            {
              rule: {
                comparator: "lt", // Less than age 60
                value: "60",
              },
              penalty: {
                valueType: "percentage",
                value: createDecimalValueString("0.25"), // 25% withdrawal charge
              },
            },
          ],
          exceptions: ["first_home", "terminal_illness"], // Permitted withdrawals without penalty
        },
      ];
    case "SIPP":
      // Self-Invested Personal Pension: Minimum Pension Age 55 (rising to 57 from April 2028)
      // For simplicity, using age 55. Could be enhanced to check date >= 2028-04-06 for age 57
      return [
        {
          value: "55", // Minimum Pension Age (55, or 57 from April 2028)
          valueType: "age",
          penalties: [
            {
              rule: {
                comparator: "lt", // Less than age 55
                value: "55",
              },
              penalty: {
                valueType: "percentage",
                value: createDecimalValueString("1.0"), // 100% locked (cannot access before minimum age)
              },
            },
          ],
          exceptions: [], // No exceptions for early access to pensions
        },
      ];
    case "CISA":
      // Junior ISA: Cannot withdraw until child turns 18
      return [
        {
          value: "18", // Age 18
          valueType: "age",
          penalties: [
            {
              rule: {
                comparator: "lt", // Less than age 18
                value: "18",
              },
              penalty: {
                valueType: "percentage",
                value: createDecimalValueString("1.0"), // 100% locked (cannot access before age 18)
              },
            },
          ],
          exceptions: [], // No exceptions for Junior ISA
        },
      ];
    case "ISA":
    case "GIA":
      // Flexible withdrawals - no restrictions
      return [];
    default:
      return [];
  }
}

export function mapAssetToContributor(
  asset: ProjectionOrchestratorAssetInput
): Contributor {
  return {
    referenceId: asset.id,
    accountType: asset.accountType as AccountType,
    name: asset.name,
    type: "asset",
    currentValue: asset.currentValue,
    schedules: mapRecurringContributionsToContributorSchedules(
      asset.recurringContributions
    ),
    valueReleases: defineValueReleasePointsForAssetType(
      asset.accountType as AccountType
    ),
    bonusValues: defineBonusValuesForAssetType(
      asset.accountType as AccountType
    ),
    //A percentage value, should we convert to a decimal value string?
    expectedGrowthRate: 7,
  };
}

export function mapAssetsToContributors(
  assets: ProjectionOrchestratorAssetInput[]
): Contributor[] {
  return assets.map(mapAssetToContributor);
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
 * Calculate additional monthly contribution needed to reach milestone
 * TODO: This method should now return a positive or negative number depending on whether the user is ahead or behind the target
 */
export function calculateMonthlyContributionDifference(
  //currentMonthlyContribution: number,
  totalTargetDifference: number,
  monthsRemaining: number,
  annualGrowthRate: number
): DecimalValueString {
  
  if (monthsRemaining <= 0) {
    return createDecimalValueString("0");
  }

  // Calculate additional monthly contribution needed
  // Using future value of annuity formula solved for payment:
  // FV = PMT × [((1 + r)^n - 1) / r]
  // PMT = FV / [((1 + r)^n - 1) / r]

  const monthlyRate = Decimal(annualGrowthRate).div(100).div(12).toNumber();

  if (monthlyRate === 0) {
    // No growth, simple division
    return createDecimalValueString(
      Decimal(totalTargetDifference).div(monthsRemaining).neg().toString()
    );
  }

  const futureValueFactor = Decimal(1)
    .add(monthlyRate)
    .pow(monthsRemaining)
    .sub(1)
    .div(monthlyRate)
    .toNumber();

  const additionalMonthlyContribution = Decimal(totalTargetDifference)
    .div(futureValueFactor)
    .toNumber();

  return createDecimalValueString(
    Decimal(additionalMonthlyContribution).neg().toFixed(2)
  );
}


export function calculateYearsAheadOrBehind(
  shortfall: number,
  targetRetirementAge: number,
  currentAge: number,
  projectedValueAtRetirement: DecimalValueString
): number {
  return Decimal(shortfall)
    .div(Decimal(projectedValueAtRetirement))
    .div(targetRetirementAge - currentAge)
    .toNumber();
}
