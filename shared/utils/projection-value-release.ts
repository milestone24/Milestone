import {
  ValueReleasePointInTime,
  Contributor,
} from "@shared/schema/projections";
import {
  DecimalValueString,
  createDecimalValueString,
} from "@shared/schema/utils";
import Decimal from "decimal.js";
import { differenceInYears, parseISO } from "date-fns";

// ============================================================================
// AGE CALCULATION
// ============================================================================

/**
 * Calculate age at a specific date from date of birth
 */
export function calculateAgeAtDate(dateOfBirth: Date, date: Date): number {
  return differenceInYears(date, dateOfBirth);
}

// ============================================================================
// VALUE RELEASE ELIGIBILITY
// ============================================================================

/**
 * Check if a value release point is satisfied (eligible) at a given date
 */
export function checkValueReleaseEligibility(
  releasePoint: ValueReleasePointInTime,
  checkDate: Date,
  dateOfBirth?: Date
): {
  isEligible: boolean;
  releaseValue: string | null;
} {
  if (releasePoint.valueType === "age") {
    if (!dateOfBirth) {
      // Cannot check age without DOB
      return { isEligible: false, releaseValue: null };
    }

    const age = calculateAgeAtDate(dateOfBirth, checkDate);
    const requiredAge = parseInt(releasePoint.value, 10);

    if (isNaN(requiredAge)) {
      return { isEligible: false, releaseValue: null };
    }

    return {
      isEligible: age >= requiredAge,
      releaseValue: releasePoint.value,
    };
  } else if (releasePoint.valueType === "date") {
    let releaseDate: Date;
    try {
      releaseDate = parseISO(releasePoint.value);
      if (isNaN(releaseDate.getTime())) {
        return { isEligible: false, releaseValue: null };
      }
    } catch {
      return { isEligible: false, releaseValue: null };
    }

    return {
      isEligible: checkDate >= releaseDate,
      releaseValue: releasePoint.value,
    };
  }

  return { isEligible: false, releaseValue: null };
}

/**
 * Evaluate a penalty rule against a context
 * Returns true if the rule matches (penalty should apply)
 */
export function evaluatePenaltyRule(
  rule: {
    comparator: "lt" | "lte" | "gt" | "gte" | "eq" | "neq";
    value: string;
  },
  checkValue: string | number,
  valueType: "age" | "date"
): boolean {
  let ruleValue: number | Date;
  let checkValueTyped: number | Date;

  if (valueType === "age") {
    ruleValue = parseInt(rule.value, 10);
    checkValueTyped =
      typeof checkValue === "string" ? parseInt(checkValue, 10) : checkValue;
    if (isNaN(ruleValue) || isNaN(checkValueTyped as number)) {
      return false;
    }
  } else {
    // date
    try {
      ruleValue = parseISO(rule.value);
      checkValueTyped =
        typeof checkValue === "string" ? parseISO(checkValue) : checkValue;
      if (
        isNaN(ruleValue.getTime()) ||
        isNaN((checkValueTyped as Date).getTime())
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }

  switch (rule.comparator) {
    case "lt":
      return checkValueTyped < ruleValue;
    case "lte":
      return checkValueTyped <= ruleValue;
    case "gt":
      return checkValueTyped > ruleValue;
    case "gte":
      return checkValueTyped >= ruleValue;
    case "eq":
      return checkValueTyped === ruleValue;
    case "neq":
      return checkValueTyped !== ruleValue;
    default:
      return false;
  }
}

/**
 * Calculate penalty amount for a value
 */
export function calculatePenaltyAmount(
  value: DecimalValueString,
  penalty: {
    valueType: "percentage" | "fixed";
    value: DecimalValueString;
  }
): DecimalValueString {
  if (penalty.valueType === "percentage") {
    const penaltyRate = Decimal(penalty.value);
    const penaltyAmount = Decimal(value).mul(penaltyRate);
    return createDecimalValueString(penaltyAmount.toString());
  } else {
    // fixed
    return penalty.value;
  }
}

/**
 * Find applicable penalty for a value release point if not eligible
 */
export function findApplicablePenalty(
  releasePoint: ValueReleasePointInTime,
  checkDate: Date,
  dateOfBirth?: Date
): DecimalValueString | null {
  if (!releasePoint.penalties || releasePoint.penalties.length === 0) {
    return null;
  }

  const { isEligible, releaseValue } = checkValueReleaseEligibility(
    releasePoint,
    checkDate,
    dateOfBirth
  );

  if (isEligible || !releaseValue) {
    return null; // No penalty if eligible
  }

  // Check each penalty rule
  for (const penaltyRule of releasePoint.penalties) {
    let checkValue: string | number;

    if (releasePoint.valueType === "age") {
      if (!dateOfBirth) {
        continue;
      }
      checkValue = calculateAgeAtDate(dateOfBirth, checkDate);
    } else {
      checkValue = checkDate.toISOString();
    }

    const ruleMatches = evaluatePenaltyRule(
      penaltyRule.rule,
      checkValue,
      releasePoint.valueType
    );

    if (ruleMatches) {
      // Rule matches, but we need a value to calculate penalty on
      // For now, return the penalty structure - caller will apply to actual value
      return penaltyRule.penalty.value;
    }
  }

  return null;
}

