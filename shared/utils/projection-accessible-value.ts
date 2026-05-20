import {
  Contributor,
  ValueReleasePointInTime,
} from "@shared/schema/projections";
import {
  DecimalValueString,
  createDecimalValueString,
} from "@shared/schema/decimal-value";
import Decimal from "decimal.js";
import {
  checkValueReleaseEligibility,
  calculatePenaltyAmount,
  evaluatePenaltyRule,
  calculateAgeAtDate,
} from "./projection-value-release";

// ============================================================================
// ACCESSIBLE VALUE CALCULATION
// ============================================================================

/**
 * Calculate accessible and locked value for a contributor at a specific date
 * Returns accessible value (after penalties if early), locked value, and penalty breakdown
 */
export function calculateAccessibleValue(
  contributor: Contributor,
  totalValue: DecimalValueString,
  date: Date,
  dateOfBirth?: Date
): {
  accessibleValue: DecimalValueString;
  lockedValue: DecimalValueString;
  penaltyAmount: DecimalValueString;
  isEligible: boolean;
} {
  // If no value releases, all value is accessible
  if (!contributor.valueReleases || contributor.valueReleases.length === 0) {
    return {
      accessibleValue: totalValue,
      lockedValue: createDecimalValueString("0"),
      penaltyAmount: createDecimalValueString("0"),
      isEligible: true,
    };
  }

  // Check all release points to find the most favorable (earliest accessible)
  let earliestEligibleRelease: ValueReleasePointInTime | null = null;
  let earliestEligibleDate: Date | null = null;
  let allEligible = false;

  for (const releasePoint of contributor.valueReleases) {
    // Check if this release point is eligible
    const { isEligible } = checkValueReleaseEligibility(
      releasePoint,
      date,
      dateOfBirth
    );

    if (isEligible) {
      // Check if this is the earliest eligible release
      if (releasePoint.valueType === "date") {
        try {
          const releaseDate = new Date(releasePoint.value);
          if (
            !earliestEligibleDate ||
            releaseDate < earliestEligibleDate
          ) {
            earliestEligibleDate = releaseDate;
            earliestEligibleRelease = releasePoint;
            allEligible = true;
          }
        } catch {
          // Invalid date, skip
        }
      } else if (releasePoint.valueType === "age" && dateOfBirth) {
        // For age-based, the current date is eligible
        if (!earliestEligibleRelease) {
          earliestEligibleRelease = releasePoint;
          allEligible = true;
        }
      }
    }
  }

  // If any release point is eligible, value is accessible
  if (allEligible && earliestEligibleRelease) {
    return {
      accessibleValue: totalValue,
      lockedValue: createDecimalValueString("0"),
      penaltyAmount: createDecimalValueString("0"),
      isEligible: true,
    };
  }

  // No release point is eligible - check for penalties on earliest release
  // Find the earliest release point (most favorable)
  let earliestRelease: ValueReleasePointInTime | null = null;
  let earliestReleaseDate: Date | null = null;

  for (const releasePoint of contributor.valueReleases) {
    if (releasePoint.valueType === "date") {
      try {
        const releaseDate = new Date(releasePoint.value);
        if (!earliestReleaseDate || releaseDate < earliestReleaseDate) {
          earliestReleaseDate = releaseDate;
          earliestRelease = releasePoint;
        }
      } catch {
        // Invalid date, skip
      }
    } else if (releasePoint.valueType === "age" && dateOfBirth) {
      // Calculate when this age will be reached
      const requiredAge = parseInt(releasePoint.value, 10);
      if (!isNaN(requiredAge)) {
        const releaseDate = new Date(dateOfBirth);
        releaseDate.setFullYear(releaseDate.getFullYear() + requiredAge);
        if (!earliestReleaseDate || releaseDate < earliestReleaseDate) {
          earliestReleaseDate = releaseDate;
          earliestRelease = releasePoint;
        }
      }
    }
  }

  if (!earliestRelease) {
    // No valid release point found, assume all accessible
    return {
      accessibleValue: totalValue,
      lockedValue: createDecimalValueString("0"),
      penaltyAmount: createDecimalValueString("0"),
      isEligible: true,
    };
  }

  // Check for penalties on early withdrawal
  // Find the penalty rule that applies
  if (earliestRelease.penalties && earliestRelease.penalties.length > 0) {
    let applicablePenaltyRule = null;

    for (const penaltyRule of earliestRelease.penalties) {
      let checkValue: string | number;

      if (earliestRelease.valueType === "age") {
        if (!dateOfBirth) {
          continue;
        }
        checkValue = calculateAgeAtDate(dateOfBirth, date);
      } else {
        checkValue = date.toISOString();
      }

      const ruleMatches = evaluatePenaltyRule(
        penaltyRule.rule,
        checkValue,
        earliestRelease.valueType
      );

      if (ruleMatches) {
        applicablePenaltyRule = penaltyRule;
        break;
      }
    }

    if (applicablePenaltyRule) {
      // Calculate penalty amount
      const penaltyAmount = calculatePenaltyAmount(
        totalValue,
        applicablePenaltyRule.penalty
      );

      // Accessible value is total minus penalty
      const accessibleValue = Decimal.max(
        Decimal(totalValue).sub(penaltyAmount),
        0
      );
      const lockedValue = Decimal.max(penaltyAmount, 0);

      return {
        accessibleValue: createDecimalValueString(accessibleValue.toString()),
        lockedValue: createDecimalValueString(lockedValue.toString()),
        penaltyAmount,
        isEligible: false,
      };
    }
  }

  // No penalty, but value is locked until release point
  return {
    accessibleValue: createDecimalValueString("0"),
    lockedValue: totalValue,
    penaltyAmount: createDecimalValueString("0"),
    isEligible: false,
  };
}

/**
 * Simplified version that returns just the accessible value
 * Useful when you don't need the breakdown
 */
export function getAccessibleValue(
  contributor: Contributor,
  totalValue: DecimalValueString,
  date: Date,
  dateOfBirth?: Date
): DecimalValueString {
  const { accessibleValue } = calculateAccessibleValue(
    contributor,
    totalValue,
    date,
    dateOfBirth
  );
  return accessibleValue;
}

