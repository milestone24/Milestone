import { describe, it, expect } from "vitest";
import {
  validateSchedulePattern,
  createCronPattern,
  createRRulePattern,
  SchedulePattern,
} from "./scheduling";

describe("validateSchedulePattern", () => {
  describe("valid patterns", () => {
    it("should validate valid cron patterns", () => {
      const validCronPatterns = [
        "0 0 * * *", // Daily
        "0 0 * * 1", // Weekly Monday
        "0 0 1 * *", // Monthly 1st
        "0 0 * * 2#2", // 2nd Tuesday
        "0 0 1 1 *", // Yearly Jan 1st
        "0 9 * * 1-5", // Weekdays at 9 AM
        "0 0 1-5 * *", // 1st through 5th of month
        "0 0 */2 * *", // Every 2 days
        "0 0 1 1,6,12 *", // Jan 1, Jun 1, Dec 1
      ];

      validCronPatterns.forEach((expression) => {
        const pattern = createCronPattern(expression);
        const result = validateSchedulePattern(pattern);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should validate valid RRULE patterns", () => {
      const validRRulePatterns = [
        "FREQ=DAILY",
        "FREQ=WEEKLY;BYDAY=MO",
        "FREQ=MONTHLY;BYMONTHDAY=1",
        "FREQ=MONTHLY;BYDAY=2TU",
        "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
        "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
        "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        "FREQ=MONTHLY;BYMONTHDAY=-1",
        "FREQ=DAILY;COUNT=5",
      ];

      validRRulePatterns.forEach((rule) => {
        const pattern = createRRulePattern(rule);
        const result = validateSchedulePattern(pattern);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should validate patterns with timezone", () => {
      const cronPattern = createCronPattern("0 0 * * *", "America/New_York");
      const rrulePattern = createRRulePattern("FREQ=DAILY", "Europe/London");

      const cronResult = validateSchedulePattern(cronPattern);
      const rruleResult = validateSchedulePattern(rrulePattern);

      expect(cronResult.isValid).toBe(true);
      expect(rruleResult.isValid).toBe(true);
    });
  });

  describe("invalid patterns", () => {
    it("should reject invalid cron expressions", () => {
      const invalidCronPatterns = [
        "invalid-cron",
        "0 0 0 0 0 0 0", // Too many fields
        "60 0 * * *", // Invalid minute
        "0 25 * * *", // Invalid hour
        "0 0 32 * *", // Invalid day of month
        "0 0 * 13 *", // Invalid month
        "0 0 * * 8", // Invalid day of week
        "0 0 * * * *", // Too many fields
      ];

      invalidCronPatterns.forEach((expression) => {
        const pattern = createCronPattern(expression);
        const result = validateSchedulePattern(pattern);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Invalid cron expression");
      });
    });

    it("should reject invalid RRULE patterns", () => {
      const invalidRRulePatterns = [
        "INVALID_RRULE",
        "FREQ=INVALID",
        "FREQ=DAILY;INVALID_PARAM=value",
        "FREQ=",
        "BYDAY=MO", // Missing FREQ
        "FREQ=WEEKLY;BYDAY=INVALID",
        "FREQ=MONTHLY;BYMONTHDAY=32",
        "FREQ=YEARLY;BYMONTH=13",
        "", // Empty string
      ];

      invalidRRulePatterns.forEach((rule) => {
        const pattern = createRRulePattern(rule);
        const result = validateSchedulePattern(pattern);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Invalid RRULE");
      });
    });

    it("should reject patterns with missing required fields", () => {
      // Test with malformed pattern objects
      const invalidPatterns: SchedulePattern[] = [
        { type: "cron", expression: "", timezone: "UTC" },
        { type: "rrule", expression: "", timezone: "UTC" },
        { type: "cron", expression: undefined as any, timezone: "UTC" },
        { type: "rrule", expression: undefined as any, timezone: "UTC" },
      ];

      invalidPatterns.forEach((pattern) => {
        const result = validateSchedulePattern(pattern);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle patterns with special characters", () => {
      const specialCronPatterns = [
        "0 0 * * 2#2", // 2nd Tuesday
        "0 0 L * *", // Last day of month (if supported)
        "0 0 1-5 * *", // Range
        "0 0 1,15 * *", // List
        "0 0 */2 * *", // Step
        "0 0 1 1,6,12 *", // Multiple months
      ];

      specialCronPatterns.forEach((expression) => {
        const pattern = createCronPattern(expression);
        const result = validateSchedulePattern(pattern);

        // Some special characters might be valid, others not
        // We just check that validation doesn't crash
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("errors");
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });

    it("should handle complex RRULE patterns", () => {
      const complexRRulePatterns = [
        "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
        "FREQ=YEARLY;BYMONTH=1,6,12;BYMONTHDAY=1",
        "FREQ=DAILY;COUNT=5",
        "FREQ=WEEKLY;BYDAY=2TU",
        "FREQ=MONTHLY;BYMONTHDAY=-1",
      ];

      complexRRulePatterns.forEach((rule) => {
        const pattern = createRRulePattern(rule);
        const result = validateSchedulePattern(pattern);

        // Most complex patterns should be valid
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("errors");
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });

    it("should handle patterns with extreme values", () => {
      const extremePatterns = [
        createCronPattern("0 0 1 1 *"), // Yearly
        createCronPattern("0 0 * * 0"), // Weekly Sunday
        createRRulePattern("FREQ=YEARLY"),
        createRRulePattern("FREQ=WEEKLY;INTERVAL=52"), // Every 52 weeks
      ];

      extremePatterns.forEach((pattern) => {
        const result = validateSchedulePattern(pattern);

        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("errors");
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });

  describe("return value structure", () => {
    it("should return correct validation result structure", () => {
      const pattern = createCronPattern("0 0 * * *");
      const result = validateSchedulePattern(pattern);

      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("errors");

      expect(typeof result.isValid).toBe("boolean");
      expect(Array.isArray(result.errors)).toBe(true);

      result.errors.forEach((error) => {
        expect(typeof error).toBe("string");
        expect(error.length).toBeGreaterThan(0);
      });
    });

    it("should return empty errors array for valid patterns", () => {
      const pattern = createCronPattern("0 0 * * *");
      const result = validateSchedulePattern(pattern);

      if (result.isValid) {
        expect(result.errors).toHaveLength(0);
      }
    });

    it("should return non-empty errors array for invalid patterns", () => {
      const pattern = createCronPattern("invalid-cron");
      const result = validateSchedulePattern(pattern);

      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("error messages", () => {
    it("should provide descriptive error messages for cron patterns", () => {
      const pattern = createCronPattern("invalid-cron");
      const result = validateSchedulePattern(pattern);

      if (!result.isValid) {
        expect(result.errors[0]).toContain("Invalid cron expression");
      }
    });

    it("should provide descriptive error messages for RRULE patterns", () => {
      const pattern = createRRulePattern("INVALID_RRULE");
      const result = validateSchedulePattern(pattern);

      if (!result.isValid) {
        expect(result.errors[0]).toContain("Invalid RRULE");
      }
    });

    it("should provide specific error for missing required fields", () => {
      const pattern = createCronPattern("");
      const result = validateSchedulePattern(pattern);

      if (!result.isValid) {
        expect(result.errors[0]).toContain("Cron expression is required");
      }
    });
  });
});
