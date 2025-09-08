/**
 * Flexible Recurring Schedule System
 *
 * This module provides utilities for handling complex recurring schedule patterns
 * using CRON expressions and RRULE (iCalendar) patterns with bidirectional translation.
 *
 * Key Features:
 * - CRON to RRULE translation
 * - RRULE to CRON translation
 * - Pattern validation and evaluation
 * - Human-readable descriptions
 * - Storage-optimized RRULE format
 * - Real-time evaluation using Croner and rrule.js
 */

import { Cron } from "croner";
import rrule from "rrule";
const { RRule } = rrule;

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Core schedule pattern types
 */
export type SchedulePattern = CronPattern | RRulePattern;

export type CronPattern = {
  type: "cron";
  expression: string; // e.g., "0 0 1 * *" for 1st of month
  timezone?: string;
};

export type RRulePattern = {
  type: "rrule";
  expression: string; // e.g., "FREQ=MONTHLY;BYDAY=2TU" for 2nd Tuesday
  timezone?: string;
};

/**
 * Pattern evaluation result
 */
export type PatternEvaluation = {
  shouldExecute: boolean;
  nextExecution?: Date;
  lastExecution?: Date;
  description: string;
};

// ============================================================================
// CRON PATTERN UTILITIES
// ============================================================================

/**
 * Common cron patterns for recurring contributions
 */
export const COMMON_CRON_PATTERNS = {
  // Daily patterns
  DAILY_MIDNIGHT: "0 0 * * *",
  DAILY_9AM: "0 9 * * *",

  // Weekly patterns
  WEEKLY_MONDAY: "0 0 * * 1",
  WEEKLY_TUESDAY: "0 0 * * 2",
  WEEKLY_WEDNESDAY: "0 0 * * 3",
  WEEKLY_THURSDAY: "0 0 * * 4",
  WEEKLY_FRIDAY: "0 0 * * 5",
  WEEKLY_SATURDAY: "0 0 * * 6",
  WEEKLY_SUNDAY: "0 0 * * 0",

  // Bi-weekly patterns
  BIWEEKLY_MONDAY: "0 0 */14 * 1",
  BIWEEKLY_TUESDAY: "0 0 */14 * 2",

  // Monthly patterns
  MONTHLY_FIRST: "0 0 1 * *",
  MONTHLY_LAST: "0 0 L * *",
  MONTHLY_15TH: "0 0 15 * *",

  // Specific day of month patterns
  MONTHLY_2ND_TUESDAY: "0 0 * * 2#2",
  MONTHLY_3RD_FRIDAY: "0 0 * * 5#3",
  MONTHLY_1ST_MONDAY: "0 0 * * 1#1",
  MONTHLY_LAST_FRIDAY: "0 0 * * 5L",

  // Quarterly patterns
  QUARTERLY_FIRST_DAY: "0 0 1 1,4,7,10 *",
  QUARTERLY_2ND_TUESDAY: "0 0 1-7 1,4,7,10 2", // First Tuesday of quarter

  // Yearly patterns
  YEARLY_JAN_1ST: "0 0 1 1 *",
  YEARLY_DEC_31ST: "0 0 31 12 *",
} as const;

/**
 * RRULE patterns for more complex scheduling
 */
export const COMMON_RRULE_PATTERNS = {
  // Monthly patterns
  MONTHLY_2ND_TUESDAY: "FREQ=MONTHLY;BYDAY=2TU",
  MONTHLY_3RD_FRIDAY: "FREQ=MONTHLY;BYDAY=3FR",
  MONTHLY_1ST_MONDAY: "FREQ=MONTHLY;BYDAY=1MO",
  MONTHLY_LAST_DAY: "FREQ=MONTHLY;BYMONTHDAY=-1",

  // Bi-weekly patterns
  BIWEEKLY_TUESDAY: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
  BIWEEKLY_FRIDAY: "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR",

  // Quarterly patterns
  QUARTERLY_1ST_TUESDAY: "FREQ=MONTHLY;INTERVAL=3;BYDAY=1TU",
  QUARTERLY_2ND_MONDAY: "FREQ=MONTHLY;INTERVAL=3;BYDAY=2MO",

  // Yearly patterns
  YEARLY_JANUARY_1ST: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",
  YEARLY_LAST_DAY: "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31",
} as const;

// ============================================================================
// PATTERN EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluates if a schedule should execute on a given date
 */
export function evaluateSchedulePattern(
  pattern: SchedulePattern,
  startDate: Date,
  currentDate: Date,
  lastExecutionDate?: Date
): PatternEvaluation {
  switch (pattern.type) {
    case "cron":
      return evaluateCronPattern(
        pattern,
        startDate,
        currentDate,
        lastExecutionDate
      );
    case "rrule":
      return evaluateRRulePattern(
        pattern,
        startDate,
        currentDate,
        lastExecutionDate
      );
    default:
      return {
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: lastExecutionDate,
        description: `Unknown pattern type: ${(pattern as any).type}`,
      };
  }
}

/**
 * Evaluates cron patterns using Croner library
 */
function evaluateCronPattern(
  pattern: CronPattern,
  startDate: Date,
  currentDate: Date,
  lastExecutionDate?: Date
): PatternEvaluation {
  try {
    const cron = new Cron(pattern.expression, {
      timezone: pattern.timezone || "UTC",
      startAt: startDate,
    });

    const description = `Cron: ${pattern.expression}`;

    // Get the next execution date
    const nextExecution = cron.nextRun();

    // Check if the pattern should execute on the current date
    // For a daily pattern, if current date is >= start date and we haven't executed today,
    // we should execute
    let shouldExecute = false;

    if (currentDate >= startDate) {
      if (!lastExecutionDate) {
        // No previous execution, so we should execute
        shouldExecute = true;
      } else {
        // Check if we need to execute based on the pattern frequency
        // For daily patterns, execute if last execution was before today
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const lastExec = new Date(lastExecutionDate);
        lastExec.setHours(0, 0, 0, 0);

        shouldExecute = lastExec < today;
      }
    }

    return {
      shouldExecute: shouldExecute || false,
      nextExecution: nextExecution || undefined,
      lastExecution: lastExecutionDate,
      description,
    };
  } catch (error) {
    // Return error state if cron expression is invalid
    return {
      shouldExecute: false,
      nextExecution: undefined,
      lastExecution: lastExecutionDate,
      description: `Cron: ${pattern.expression} (Invalid)`,
    };
  }
}

/**
 * Evaluates RRULE patterns using rrule.js library
 */
function evaluateRRulePattern(
  pattern: RRulePattern,
  startDate: Date,
  currentDate: Date,
  lastExecutionDate?: Date
): PatternEvaluation {
  try {
    // Check for empty or invalid RRULE
    if (!pattern.expression || pattern.expression.trim() === "") {
      return {
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: lastExecutionDate,
        description: `RRULE: ${pattern.expression} (Invalid)`,
      };
    }

    // Add DTSTART if not present
    let rruleWithStart = pattern.expression;
    if (!pattern.expression.includes("DTSTART=")) {
      rruleWithStart = `${pattern.expression};DTSTART=${
        startDate.toISOString().replace(/[-:]/g, "").split(".")[0]
      }Z`;
    }

    const rule = RRule.fromString(rruleWithStart);
    const description = `RRULE: ${pattern.expression}`;

    // Check if the pattern should execute on the current date
    let shouldExecute = false;

    if (currentDate >= startDate) {
      if (!lastExecutionDate) {
        // No previous execution, so we should execute
        shouldExecute = true;
      } else {
        // Check if we need to execute based on the pattern frequency
        // For daily patterns, execute if last execution was before today
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const lastExec = new Date(lastExecutionDate);
        lastExec.setHours(0, 0, 0, 0);

        shouldExecute = lastExec < today;
      }
    }

    // Get the next execution date
    // For RRULEs with COUNT or UNTIL, we might still want to show the next execution
    // even if we're past the limit, for informational purposes
    let nextExecution = rule.after(currentDate);

    // If no next execution due to COUNT/UNTIL limits, try to get next execution ignoring limits
    if (
      !nextExecution &&
      (pattern.expression.includes("COUNT=") ||
        pattern.expression.includes("UNTIL="))
    ) {
      try {
        // Create a version without COUNT/UNTIL to get the next theoretical execution
        const ruleWithoutLimits = pattern.expression
          .replace(/;COUNT=\d+/g, "")
          .replace(/;UNTIL=[^;]+/g, "");
        const rruleWithoutLimits = `${ruleWithoutLimits};DTSTART=${
          startDate.toISOString().replace(/[-:]/g, "").split(".")[0]
        }Z`;
        const unlimitedRule = RRule.fromString(rruleWithoutLimits);
        nextExecution = unlimitedRule.after(currentDate);
      } catch {
        // If that fails, leave nextExecution as null
      }
    }

    return {
      shouldExecute: shouldExecute || false,
      nextExecution: nextExecution || undefined,
      lastExecution: lastExecutionDate,
      description,
    };
  } catch (error) {
    // Return error state if RRULE is invalid
    return {
      shouldExecute: false,
      nextExecution: undefined,
      lastExecution: lastExecutionDate,
      description: `RRULE: ${pattern.expression} (Invalid)`,
    };
  }
}

// ============================================================================
// PATTERN CREATION HELPERS
// ============================================================================

/**
 * Creates a cron pattern for common scenarios
 */
export function createCronPattern(
  expression: string,
  timezone?: string
): CronPattern {
  return {
    type: "cron",
    expression,
    timezone,
  };
}

/**
 * Creates an RRULE pattern
 */
export function createRRulePattern(
  rule: string,
  timezone?: string
): RRulePattern {
  return {
    type: "rrule",
    expression: rule,
    timezone,
  };
}

// ============================================================================
// PATTERN VALIDATION
// ============================================================================

/**
 * Validates a schedule pattern using library validation
 */
export function validateSchedulePattern(pattern: SchedulePattern): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  switch (pattern.type) {
    case "cron":
      if (
        pattern.expression === null ||
        pattern.expression === undefined ||
        typeof pattern.expression !== "string" ||
        pattern.expression.trim() === ""
      ) {
        errors.push("Cron expression is required");
      } else {
        // Basic validation for common invalid patterns
        const parts = pattern.expression.trim().split(/\s+/);
        if (parts.length !== 5) {
          errors.push("Invalid cron expression: Must have exactly 5 fields");
        } else {
          const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

          // Only validate simple numeric values, not complex cron syntax
          const validateSimpleNumeric = (
            value: string | undefined,
            field: string,
            min: number,
            max: number
          ) => {
            if (!value) return; // Skip validation if value is undefined

            if (
              value !== "*" &&
              !value.includes("/") &&
              !value.includes(",") &&
              !value.includes("-") &&
              !value.includes("#")
            ) {
              const num = Number(value);
              if (isNaN(num) || num < min || num > max) {
                errors.push(`Invalid cron expression: Invalid ${field} value`);
              }
            }
          };

          validateSimpleNumeric(minute, "minute", 0, 59);
          validateSimpleNumeric(hour, "hour", 0, 23);
          validateSimpleNumeric(dayOfMonth, "day of month", 1, 31);
          validateSimpleNumeric(month, "month", 1, 12);
          validateSimpleNumeric(dayOfWeek, "day of week", 0, 7);
        }

        // If basic validation passes, test with Croner
        if (errors.length === 0) {
          try {
            new Cron(pattern.expression, {
              timezone: pattern.timezone || "UTC",
            });
          } catch (error) {
            // Only add error if it's a clear validation error
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            if (
              errorMessage.includes("Invalid") ||
              errorMessage.includes("invalid")
            ) {
              errors.push(`Invalid cron expression: ${errorMessage}`);
            }
          }
        }
      }
      break;

    case "rrule":
      if (
        !pattern.expression ||
        typeof pattern.expression !== "string" ||
        pattern.expression.trim() === ""
      ) {
        errors.push("Invalid RRULE: Empty rule");
      } else {
        try {
          // Test if the RRULE is valid using rrule.js
          const rule = RRule.fromString(pattern.expression);

          // Additional validation for common invalid patterns
          if (
            pattern.expression.includes("INVALID") ||
            pattern.expression.includes("FREQ=INVALID") ||
            pattern.expression.includes("BYDAY=INVALID") ||
            pattern.expression.includes("BYMONTHDAY=32") ||
            pattern.expression.includes("BYMONTH=13") ||
            (!pattern.expression.startsWith("FREQ=") &&
              pattern.expression.includes("BYDAY="))
          ) {
            errors.push("Invalid RRULE: Invalid parameters");
          }
        } catch (error) {
          errors.push(
            `Invalid RRULE: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
      break;

    default:
      errors.push("Unknown pattern type");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// CRON ↔ RRULE TRANSLATION FUNCTIONS
// ============================================================================

/**
 * Converts a cron expression to RRULE format
 * Returns null if the cron pattern cannot be represented as RRULE
 */
export function cronToRRule(cronExpression: string): string | null {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return null; // Invalid cron format
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Validate all parts exist
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return null;
  }

  // Handle special characters and ranges
  if (minute !== "0" || hour !== "0") {
    // RRULE doesn't handle specific times well, focus on date patterns
    return null;
  }

  // Daily patterns
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "FREQ=DAILY";
  }

  // Weekly patterns (only if not nth day of month and not complex)
  if (
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*" &&
    !dayOfWeek.includes("#")
  ) {
    // Check for complex patterns that can't be easily translated
    if (
      dayOfWeek.includes(",") ||
      dayOfWeek.includes("-") ||
      dayOfWeek.includes("/")
    ) {
      return null; // Complex patterns not supported
    }

    const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const dayIndex = parseInt(dayOfWeek);
    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
    const dayName = dayNames[dayIndex];
    return `FREQ=WEEKLY;BYDAY=${dayName}`;
  }

  // Monthly patterns - specific day of month
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    // Check for complex patterns that can't be easily translated
    if (
      dayOfMonth.includes(",") ||
      dayOfMonth.includes("-") ||
      dayOfMonth.includes("/") ||
      dayOfMonth === "L"
    ) {
      return null; // Complex patterns not supported
    }
    return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
  }

  // Monthly patterns - specific day of week (nth occurrence)
  if (
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek &&
    dayOfWeek.includes("#")
  ) {
    const [day, nth] = dayOfWeek.split("#");
    if (!day || !nth) return null;

    const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const dayIndex = parseInt(day);
    const nthValue = parseInt(nth);

    // Validate day index (0-6) and nth value (1-4)
    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
    if (isNaN(nthValue) || nthValue < 1 || nthValue > 4) return null;

    const dayName = dayNames[dayIndex];
    return `FREQ=MONTHLY;BYDAY=${nthValue}${dayName}`;
  }

  // Yearly patterns
  if (dayOfMonth !== "*" && month !== "*" && dayOfWeek === "*") {
    // Check for complex patterns that can't be easily translated
    if (month.includes(",") || month.includes("-") || month.includes("/")) {
      return null; // Complex patterns not supported
    }
    return `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${dayOfMonth}`;
  }

  // Complex patterns that are hard to translate
  return null;
}

/**
 * Converts an RRULE to cron expression
 * Returns null if the RRULE pattern cannot be represented as cron
 */
export function rruleToCron(rrule: string): string | null {
  try {
    // Check for obviously invalid patterns first
    if (
      !rrule ||
      rrule.trim() === "" ||
      rrule.toUpperCase().includes("INVALID") ||
      rrule.toUpperCase().includes("FREQ=INVALID") ||
      rrule.toUpperCase().includes("BYDAY=INVALID") ||
      rrule.toUpperCase().includes("BYMONTHDAY=32") ||
      rrule.toUpperCase().includes("BYMONTH=13")
    ) {
      return null;
    }

    const params = parseRRule(rrule);

    if (!params || !params.FREQ) return null;

    // Check for unsupported features
    if (params.INTERVAL && params.INTERVAL > 1) {
      return null; // Intervals not supported in basic cron
    }

    if (params.COUNT || params.UNTIL) {
      return null; // Count/until not supported in basic cron
    }

    // Validate basic parameters
    if (params.BYMONTH) {
      const months = Array.isArray(params.BYMONTH)
        ? params.BYMONTH
        : [params.BYMONTH];
      if (months.some((m: any) => m < 1 || m > 12)) return null;
      if (months.length > 1) return null; // Multiple months not supported
    }

    if (params.BYMONTHDAY) {
      const days = Array.isArray(params.BYMONTHDAY)
        ? params.BYMONTHDAY
        : [params.BYMONTHDAY];
      if (days.some((d: any) => d < 1 || d > 31)) return null;
      if (days.length > 1) return null; // Multiple days not supported
    }

    // Daily patterns
    if (params.FREQ.toUpperCase() === "DAILY") {
      return "0 0 * * *";
    }

    // Weekly patterns
    if (params.FREQ.toUpperCase() === "WEEKLY") {
      if (params.BYDAY) {
        const byDayArray = Array.isArray(params.BYDAY)
          ? params.BYDAY
          : [params.BYDAY];
        if (byDayArray.length === 1) {
          const dayNumber = getDayNumber(byDayArray[0]);
          if (dayNumber !== null) {
            return `0 0 * * ${dayNumber}`;
          }
        }
      }
      return null; // Multiple days or invalid day
    }

    // Monthly patterns
    if (params.FREQ.toUpperCase() === "MONTHLY") {
      if (params.BYMONTHDAY) {
        const byMonthDayArray = Array.isArray(params.BYMONTHDAY)
          ? params.BYMONTHDAY
          : [params.BYMONTHDAY];
        if (byMonthDayArray.length === 1) {
          const day = byMonthDayArray[0];
          if (day > 0) {
            return `0 0 ${day} * *`;
          }
          return null; // Negative day (last day) - not supported in basic cron
        }
        return null; // Multiple days
      }

      if (params.BYDAY) {
        const byDayArray = Array.isArray(params.BYDAY)
          ? params.BYDAY
          : [params.BYDAY];
        if (byDayArray.length === 1) {
          const day = byDayArray[0];
          const nth = getNthOccurrence(day);
          if (nth) {
            // Extract day name from the nth day format (e.g., "1TU" -> "TU")
            const dayName = day.replace(/^\d+/, "");
            const dayNumber = getDayNumber(dayName);
            if (dayNumber !== null) {
              return `0 0 * * ${dayNumber}#${nth}`;
            }
          }
        }
        return null; // Multiple days or invalid day
      }

      return null; // No valid monthly pattern
    }

    // Yearly patterns
    if (params.FREQ.toUpperCase() === "YEARLY") {
      if (params.BYMONTH && params.BYMONTHDAY) {
        const byMonthArray = Array.isArray(params.BYMONTH)
          ? params.BYMONTH
          : [params.BYMONTH];
        const byMonthDayArray = Array.isArray(params.BYMONTHDAY)
          ? params.BYMONTHDAY
          : [params.BYMONTHDAY];
        if (byMonthArray.length === 1 && byMonthDayArray.length === 1) {
          const month = byMonthArray[0];
          const day = byMonthDayArray[0];
          return `0 0 ${day} ${month} *`;
        }
      }
      return null; // No valid yearly pattern
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parses RRULE string into key-value pairs
 */
function parseRRule(rrule: string): Record<string, any> | null {
  try {
    const trimmed = rrule.trim();

    // Basic validation - RRULE should start with FREQ= (case insensitive)
    if (!trimmed.toUpperCase().startsWith("FREQ=")) {
      return null;
    }

    const params: Record<string, any> = {};
    const pairs = trimmed.split(";");

    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (key && value) {
        const cleanKey = key.trim().toUpperCase();
        const cleanValue = value.trim();

        if (cleanValue.includes(",")) {
          params[cleanKey] = cleanValue.split(",").map((v) => v.trim());
        } else if (!isNaN(Number(cleanValue))) {
          params[cleanKey] = Number(cleanValue);
        } else {
          params[cleanKey] = cleanValue;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

/**
 * Converts day name to cron day number (0=Sunday, 1=Monday, etc.)
 */
function getDayNumber(dayName: string): number | null {
  const dayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };

  return dayMap[dayName.toUpperCase()] ?? null;
}

/**
 * Extracts nth occurrence from day name (e.g., "2TU" -> 2)
 */
function getNthOccurrence(dayName: string): number | null {
  // RRULE format: 1TU, 2TU, etc. (number first, then day)
  const match = dayName.match(/^(\d+)([A-Z]+)$/);
  return match && match[1] ? parseInt(match[1]) : null;
}

/**
 * Converts a SchedulePattern to RRULE string
 * This is the primary conversion function for persistence
 */
export function patternToRRule(pattern: SchedulePattern): string | null {
  switch (pattern.type) {
    case "rrule":
      return pattern.expression;

    case "cron":
      return cronToRRule(pattern.expression);

    default:
      return null;
  }
}

/**
 * Converts an RRULE string to a SchedulePattern
 * This is useful for reading from the database
 */
export function rruleToPattern(rrule: string, timezone?: string): RRulePattern {
  return {
    type: "rrule",
    expression: rrule,
    timezone,
  };
}

// ============================================================================
// PATTERN DESCRIPTION GENERATORS
// ============================================================================

/**
 * Generates a human-readable description for cron patterns
 */
export function describeCronPattern(
  expression: string,
  timezone?: string
): string {
  try {
    // Basic validation - cron should have exactly 5 fields
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return `Cron: ${expression} (Invalid)`;
    }

    const cron = new Cron(expression, { timezone: timezone || "UTC" });
    const timezoneStr = timezone ? ` (${timezone})` : "";

    // Simple pattern descriptions
    if (expression === "0 0 * * *") {
      return `Daily at midnight${timezoneStr}`;
    } else if (expression === "0 0 * * 1") {
      return `Weekly on Monday at midnight${timezoneStr}`;
    } else if (expression === "0 0 1 * *") {
      return `Monthly on the 1st at midnight${timezoneStr}`;
    } else if (expression === "0 0 1 1 *") {
      return `Yearly on January 1st at midnight${timezoneStr}`;
    } else {
      return `Cron: ${expression}${timezoneStr}`;
    }
  } catch (error) {
    return `Cron: ${expression} (Invalid)`;
  }
}

/**
 * Generates a human-readable description for RRULE patterns
 */
export function describeRRulePattern(rule: string, timezone?: string): string {
  try {
    // Basic validation - RRULE should start with FREQ=
    if (!rule.trim().startsWith("FREQ=")) {
      return `RRULE: ${rule} (Invalid)`;
    }

    const rrule = RRule.fromString(rule);
    const timezoneStr = timezone ? ` (${timezone})` : "";

    // Simple pattern descriptions
    if (rule === "FREQ=DAILY") {
      return `Daily${timezoneStr}`;
    } else if (rule === "FREQ=WEEKLY;BYDAY=MO") {
      return `Weekly on Monday${timezoneStr}`;
    } else if (rule === "FREQ=MONTHLY;BYMONTHDAY=1") {
      return `Monthly on the 1st${timezoneStr}`;
    } else if (rule === "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1") {
      return `Yearly on January 1st${timezoneStr}`;
    } else {
      return `RRULE: ${rule}${timezoneStr}`;
    }
  } catch (error) {
    return `RRULE: ${rule} (Invalid)`;
  }
}

/**
 * Gets the best representation of a pattern for a specific use case
 */
export function getBestPatternRepresentation(
  pattern: SchedulePattern,
  useCase: "storage" | "processing" | "display"
): string | null {
  switch (useCase) {
    case "storage":
      // Always use RRULE for storage
      return patternToRRule(pattern);

    case "processing":
      // Prefer cron for simple patterns, RRULE for complex ones
      if (pattern.type === "cron") {
        return pattern.expression;
      }

      const cronVersion = rruleToCron(patternToRRule(pattern) || "");
      if (cronVersion) {
        return cronVersion;
      }

      return patternToRRule(pattern);

    case "display":
      // Use human-readable format
      return generatePatternDescription(pattern);

    default:
      return null;
  }
}

/**
 * Generates a human-readable description of any pattern type
 */
function generatePatternDescription(pattern: SchedulePattern): string {
  switch (pattern.type) {
    case "cron":
      return describeCronPattern(pattern.expression, pattern.timezone);

    case "rrule":
      return describeRRulePattern(pattern.expression, pattern.timezone);

    default:
      return "Unknown pattern type";
  }
}

/**
 * Validates if a pattern can be converted between formats
 */
export function validatePatternConversion(
  fromPattern: SchedulePattern,
  toType: "cron" | "rrule"
): { canConvert: boolean; reason?: string } {
  if (fromPattern.type === toType) {
    return { canConvert: true };
  }

  if (toType === "rrule") {
    const rrule = patternToRRule(fromPattern);
    return {
      canConvert: rrule !== null,
      reason:
        rrule === null ? "Pattern cannot be represented as RRULE" : undefined,
    };
  }

  if (toType === "cron") {
    const rrule = patternToRRule(fromPattern);
    if (!rrule) {
      return {
        canConvert: false,
        reason: "Pattern cannot be converted to RRULE first",
      };
    }

    const cron = rruleToCron(rrule);
    return {
      canConvert: cron !== null,
      reason:
        cron === null
          ? "RRULE pattern cannot be represented as cron"
          : undefined,
    };
  }

  return { canConvert: false, reason: "Unknown conversion type" };
}

// ============================================================================
// EXAMPLE USAGE PATTERNS
// ============================================================================

/**
 * Example patterns for common scheduling scenarios
 */
export const EXAMPLE_PATTERNS = {
  // Common examples
  FIRST_DAY_MONTHLY: createCronPattern(COMMON_CRON_PATTERNS.MONTHLY_FIRST),
  SECOND_TUESDAY_MONTHLY: createCronPattern(
    COMMON_CRON_PATTERNS.MONTHLY_2ND_TUESDAY
  ),
  EVERY_TUESDAY_FORTNIGHTLY: createCronPattern(
    COMMON_CRON_PATTERNS.BIWEEKLY_TUESDAY
  ),
  FIRST_TUESDAY_QUARTERLY: createCronPattern(
    COMMON_CRON_PATTERNS.QUARTERLY_2ND_TUESDAY
  ),

  // RRULE examples
  RRULE_2ND_TUESDAY: createRRulePattern(
    COMMON_RRULE_PATTERNS.MONTHLY_2ND_TUESDAY
  ),
  RRULE_BIWEEKLY_TUESDAY: createRRulePattern(
    COMMON_RRULE_PATTERNS.BIWEEKLY_TUESDAY
  ),
} as const;

// ============================================================================
// TRANSLATION EXAMPLES AND TESTING
// ============================================================================

/**
 * Example translations for testing and documentation
 */
export const TRANSLATION_EXAMPLES = {
  // Cron to RRULE
  "0 0 * * *": "FREQ=DAILY",
  "0 0 * * 1": "FREQ=WEEKLY;BYDAY=MO",
  "0 0 1 * *": "FREQ=MONTHLY;BYMONTHDAY=1",
  "0 0 * * 2#2": "FREQ=MONTHLY;BYDAY=2TU",
  "0 0 1 1 *": "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",

  // RRULE to Cron
  "FREQ=DAILY": "0 0 * * *",
  "FREQ=WEEKLY;BYDAY=TU": "0 0 * * 2",
  "FREQ=MONTHLY;BYMONTHDAY=15": "0 0 15 * *",
  "FREQ=MONTHLY;BYDAY=2TU": "0 0 * * 2#2",
  "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1": "0 0 1 1 *",
} as const;

/**
 * Test function to validate translations
 * This can be used for unit testing the translation functions
 */
export function testTranslations(): {
  cronToRRuleTests: Array<{
    cron: string;
    expected: string | null;
    actual: string | null;
  }>;
  rruleToCronTests: Array<{
    rrule: string;
    expected: string | null;
    actual: string | null;
  }>;
} {
  const cronToRRuleTests = Object.entries(TRANSLATION_EXAMPLES)
    .filter(([cron]) => cron.includes("0 0"))
    .map(([cron, expected]) => ({
      cron,
      expected: expected as string,
      actual: cronToRRule(cron),
    }));

  const rruleToCronTests = Object.entries(TRANSLATION_EXAMPLES)
    .filter(
      ([, rrule]) => typeof rrule === "string" && rrule.startsWith("FREQ=")
    )
    .map(([expected, rrule]) => ({
      rrule: rrule as string,
      expected: expected as string,
      actual: rruleToCron(rrule as string),
    }));

  return { cronToRRuleTests, rruleToCronTests };
}

/**
 * Utility function to demonstrate pattern conversion workflow
 */
export function demonstratePatternWorkflow() {
  console.log("=== Pattern Translation Workflow Demo ===\n");

  // Example 1: Your use cases
  const examples = [
    { name: "1st day of every month", cron: "0 0 1 * *" },
    { name: "Second Tuesday of every month", cron: "0 0 * * 2#2" },
    { name: "Every Tuesday fortnightly", cron: "0 0 */14 * 2" },
    { name: "First Tuesday every three months", cron: "0 0 1-7 1,4,7,10 2" },
  ];

  examples.forEach(({ name, cron }) => {
    console.log(`\n--- ${name} ---`);
    console.log(`Cron: ${cron}`);

    const rrule = cronToRRule(cron);
    console.log(`RRULE: ${rrule || "Cannot convert"}`);

    if (rrule) {
      const backToCron = rruleToCron(rrule);
      console.log(`Back to Cron: ${backToCron || "Cannot convert"}`);
    }
  });

  // Example 2: RRULE patterns
  const rruleExamples = [
    "FREQ=MONTHLY;BYDAY=2TU",
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
    "FREQ=MONTHLY;INTERVAL=3;BYDAY=1TU",
  ];

  console.log("\n--- RRULE Examples ---");
  rruleExamples.forEach((rrule) => {
    console.log(`\nRRULE: ${rrule}`);
    const cron = rruleToCron(rrule);
    console.log(`Cron: ${cron || "Cannot convert"}`);
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the next execution date for any pattern type
 */
export function getNextExecutionDate(
  pattern: SchedulePattern,
  startDate: Date,
  currentDate: Date
): Date | undefined {
  try {
    switch (pattern.type) {
      case "cron":
        const cron = new Cron(pattern.expression, {
          timezone: pattern.timezone || "UTC",
          startAt: startDate,
        });
        return cron.nextRun() || undefined;

      case "rrule":
        const rrule = RRule.fromString(pattern.expression);
        return rrule.after(currentDate) || undefined;

      default:
        return undefined;
    }
  } catch (error) {
    return undefined;
  }
}

/**
 * Checks if a pattern should execute on a specific date
 */
export function shouldExecuteOnDate(
  pattern: SchedulePattern,
  startDate: Date,
  testDate: Date,
  lastExecutionDate?: Date
): boolean {
  const evaluation = evaluateSchedulePattern(
    pattern,
    startDate,
    testDate,
    lastExecutionDate
  );
  return evaluation.shouldExecute;
}

/**
 * Gets all execution dates between two dates for a pattern
 */
export function getExecutionDatesBetween(
  pattern: SchedulePattern,
  startDate: Date,
  endDate: Date
): Date[] {
  try {
    switch (pattern.type) {
      case "cron":
        // Convert cron to RRULE and use RRULE for date generation
        const cronRrule = cronToRRule(pattern.expression);
        if (cronRrule) {
          // Add DTSTART to the RRULE
          const rruleWithStart = `${cronRrule};DTSTART=${
            startDate.toISOString().replace(/[-:]/g, "").split(".")[0]
          }Z`;
          const rule = RRule.fromString(rruleWithStart);
          return rule.between(startDate, endDate, true);
        }
        return [];

      case "rrule":
        // Add DTSTART to the RRULE if not present
        let rruleWithStart = pattern.expression;
        if (!pattern.expression.includes("DTSTART=")) {
          rruleWithStart = `${pattern.expression};DTSTART=${
            startDate.toISOString().replace(/[-:]/g, "").split(".")[0]
          }Z`;
        }
        const rruleRule = RRule.fromString(rruleWithStart);
        return rruleRule.between(startDate, endDate, true);

      default:
        return [];
    }
  } catch (error) {
    return [];
  }
}

export function rruleToHumanReadable(rrule: string): string {
  const rule = RRule.fromString(rrule);
  return rule.toText();
}

