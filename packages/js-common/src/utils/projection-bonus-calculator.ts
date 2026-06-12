import { BonusValue } from "../schema/projections";
import {
  DecimalValueString,
  createDecimalValueString,
} from "../schema/decimal-value";
import Decimal from "decimal.js";
import { startOfYear, setMonth, setDate } from "date-fns";

// ============================================================================
// TAX YEAR HELPERS
// ============================================================================

/**
 * UK tax year starts on April 6th
 * Returns the start date of the tax year for a given date
 */
export function getTaxYearStart(date: Date): Date {
  const year = date.getFullYear();
  const taxYearStart = setDate(setMonth(new Date(year, 0, 1), 3), 6); // April 6

  // If date is before April 6, tax year started in previous year
  if (date < taxYearStart) {
    return setDate(setMonth(new Date(year - 1, 0, 1), 3), 6);
  }

  return taxYearStart;
}

/**
 * Get tax year identifier string for a given date (e.g., "2024-2025")
 */
export function getTaxYearForDate(date: Date): string {
  const taxYearStart = getTaxYearStart(date);
  const startYear = taxYearStart.getFullYear();
  const endYear = startYear + 1;
  return `${startYear}-${endYear}`;
}

/**
 * Check if a date is at the start of a new tax year (April 6)
 */
export function isTaxYearBoundary(date: Date): boolean {
  const taxYearStart = getTaxYearStart(date);
  return (
    date.getDate() === 6 &&
    date.getMonth() === 3 && // April (0-indexed)
    date.getFullYear() === taxYearStart.getFullYear()
  );
}

// ============================================================================
// BONUS CALCULATION
// ============================================================================

/**
 * Annual usage tracking structure for a bonus
 * Tracks both contribution usage (for contribution limits) and bonus usage (for bonus limits)
 */
export interface BonusAnnualUsage {
  contributionUsage: Map<string, DecimalValueString>; // taxYear -> contribution amount
  bonusUsage: Map<string, DecimalValueString>; // taxYear -> bonus amount
}

/**
 * Calculate bonus for a single contribution
 * Returns bonus amount and updated annual usage
 */
export function calculateBonusForContribution(
  contribution: DecimalValueString,
  bonus: BonusValue,
  contributionDate: Date,
  annualUsage: BonusAnnualUsage
): {
  bonusAmount: DecimalValueString;
  updatedAnnualUsage: BonusAnnualUsage;
} {
  const taxYear = getTaxYearForDate(contributionDate);
  const currentContributionUsage =
    annualUsage.contributionUsage.get(taxYear) || createDecimalValueString("0");
  const currentBonusUsage =
    annualUsage.bonusUsage.get(taxYear) || createDecimalValueString("0");

  let bonusAmount = createDecimalValueString("0");

  // Calculate bonus based on type
  if (bonus.valueType === "percentage") {
    const bonusRate = Decimal(bonus.value);
    bonusAmount = createDecimalValueString(
      Decimal(contribution).mul(bonusRate).toString()
    );
  } else if (bonus.valueType === "fixed") {
    bonusAmount = bonus.value;
  }

  // Check annual contribution limit if specified
  if (bonus.annualContributionLimit) {
    const contributionLimit = Decimal(bonus.annualContributionLimit);
    const contributionAmount = Decimal(contribution);

    // Check if we've already exceeded contribution limit
    if (Decimal(currentContributionUsage).gte(contributionLimit)) {
      return {
        bonusAmount: createDecimalValueString("0"),
        updatedAnnualUsage: annualUsage,
      };
    }

    // Calculate eligible portion
    const remainingContributionLimit = Decimal(contributionLimit).sub(
      currentContributionUsage
    );
    const eligibleContribution = Decimal.min(
      contributionAmount,
      remainingContributionLimit
    );

    // Recalculate bonus on eligible portion only
    if (bonus.valueType === "percentage") {
      const bonusRate = Decimal(bonus.value);
      bonusAmount = createDecimalValueString(
        eligibleContribution.mul(bonusRate).toString()
      );
    } else {
      // For fixed bonus, only apply if eligible contribution is sufficient
      // This is a simplification - may need adjustment based on requirements
      bonusAmount = bonus.value;
    }
  }

  // Check annual bonus limit if specified
  if (bonus.annualLimit) {
    const bonusLimit = Decimal(bonus.annualLimit);
    const remainingBonusLimit = Decimal(bonusLimit).sub(currentBonusUsage);

    if (remainingBonusLimit.lte(0)) {
      return {
        bonusAmount: createDecimalValueString("0"),
        updatedAnnualUsage: annualUsage,
      };
    }

    // Cap bonus at remaining limit
    if (Decimal(bonusAmount).gt(remainingBonusLimit)) {
      bonusAmount = createDecimalValueString(remainingBonusLimit.toString());
    }
  }

  // Update annual usage - track both contribution and bonus usage
  const updatedContributionUsage = new Map(annualUsage.contributionUsage);
  const updatedBonusUsage = new Map(annualUsage.bonusUsage);

  const newContributionUsage = Decimal(currentContributionUsage).add(contribution);
  updatedContributionUsage.set(
    taxYear,
    createDecimalValueString(newContributionUsage.toString())
  );

  const newBonusUsage = Decimal(currentBonusUsage).add(bonusAmount);
  updatedBonusUsage.set(
    taxYear,
    createDecimalValueString(newBonusUsage.toString())
  );

  return {
    bonusAmount,
    updatedAnnualUsage: {
      contributionUsage: updatedContributionUsage,
      bonusUsage: updatedBonusUsage,
    },
  };
}

/**
 * Apply all bonus values to a contribution
 * Returns total contribution (including bonuses), bonus breakdown, and updated annual usage
 */
export function applyBonusValuesToContribution(
  contribution: DecimalValueString,
  bonusValues: BonusValue[],
  contributionDate: Date,
  annualUsage: Map<string, BonusAnnualUsage> // Map of bonusName -> BonusAnnualUsage
): {
  totalContribution: DecimalValueString;
  totalBonus: DecimalValueString;
  bonusBreakdown: Array<{
    bonusName: string;
    amount: DecimalValueString;
  }>;
  updatedAnnualUsage: Map<string, BonusAnnualUsage>;
} {
  if (!bonusValues || bonusValues.length === 0) {
    return {
      totalContribution: contribution,
      totalBonus: createDecimalValueString("0"),
      bonusBreakdown: [],
      updatedAnnualUsage: annualUsage,
    };
  }

  // Sort bonuses by priority (lower number = higher priority)
  const sortedBonuses = [...bonusValues].sort((a, b) => {
    const priorityA = a.priority ?? 999;
    const priorityB = b.priority ?? 999;
    return priorityA - priorityB;
  });

  let totalBonus = Decimal(0);
  const bonusBreakdown: Array<{ bonusName: string; amount: DecimalValueString }> = [];
  let updatedUsage = new Map(annualUsage);

  // Apply each bonus in order
  for (const bonus of sortedBonuses) {
    const bonusUsage =
      updatedUsage.get(bonus.name) || {
        contributionUsage: new Map<string, DecimalValueString>(),
        bonusUsage: new Map<string, DecimalValueString>(),
      };
    const { bonusAmount, updatedAnnualUsage: newBonusUsage } =
      calculateBonusForContribution(contribution, bonus, contributionDate, bonusUsage);

    if (Decimal(bonusAmount).gt(0)) {
      totalBonus = totalBonus.add(bonusAmount);
      bonusBreakdown.push({
        bonusName: bonus.name,
        amount: bonusAmount,
      });
    }

    updatedUsage.set(bonus.name, newBonusUsage);
  }

  const totalContribution = Decimal(contribution).add(totalBonus);

  return {
    totalContribution: createDecimalValueString(totalContribution.toString()),
    totalBonus: createDecimalValueString(totalBonus.toString()),
    bonusBreakdown,
    updatedAnnualUsage: updatedUsage,
  };
}

