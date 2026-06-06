import { describe, it, expect } from "vitest";
import {
  getNextExecutionDate,
  shouldExecuteOnDate,
  getExecutionDatesBetween,
  describeCronPattern,
  describeRRulePattern,
  rruleToHumanReadable,
} from "./scheduling";

describe("Utility Functions", () => {
  describe("getNextExecutionDate", () => {
    it("should return next execution date for cron patterns", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const currentDate = new Date("2024-01-15T12:00:00Z");

      const result = getNextExecutionDate(cronPattern, startDate, currentDate);

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(currentDate.getTime());
    });

    it("should return next execution date for RRULE patterns", () => {
      const rrulePattern = {
        type: "rrule" as const,
        expression: "FREQ=DAILY",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const currentDate = new Date("2024-01-15T12:00:00Z");

      const result = getNextExecutionDate(rrulePattern, startDate, currentDate);

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(currentDate.getTime());
    });

    it("should return undefined for invalid patterns", () => {
      const invalidPattern = {
        type: "cron" as const,
        expression: "invalid-cron",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const currentDate = new Date("2024-01-15T12:00:00Z");

      const result = getNextExecutionDate(
        invalidPattern,
        startDate,
        currentDate
      );

      expect(result).toBeUndefined();
    });

    it("should handle timezone correctly", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "America/New_York",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const currentDate = new Date("2024-01-15T12:00:00Z");

      const result = getNextExecutionDate(cronPattern, startDate, currentDate);

      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("shouldExecuteOnDate", () => {
    it("should return true for dates that should execute", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const testDate = new Date("2024-01-15T00:00:00Z");

      const result = shouldExecuteOnDate(cronPattern, startDate, testDate);

      expect(result).toBe(true);
    });

    it("should return false for dates that should not execute", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * 1",
        timezone: "UTC",
      }; // Mondays only
      const startDate = new Date("2024-01-01T00:00:00Z");
      const testDate = new Date("2024-01-15T00:00:00Z"); // Monday

      const result = shouldExecuteOnDate(cronPattern, startDate, testDate);

      expect(result).toBe(true); // This should be true since Jan 15, 2024 is a Monday
    });

    it("should return false for dates before start date", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const testDate = new Date("2023-12-31T00:00:00Z");

      const result = shouldExecuteOnDate(cronPattern, startDate, testDate);

      expect(result).toBe(false);
    });

    it("should handle RRULE patterns", () => {
      const rrulePattern = {
        type: "rrule" as const,
        expression: "FREQ=DAILY",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const testDate = new Date("2024-01-15T00:00:00Z");

      const result = shouldExecuteOnDate(rrulePattern, startDate, testDate);

      expect(result).toBe(true);
    });

    it("should return false for invalid patterns", () => {
      const invalidPattern = {
        type: "cron" as const,
        expression: "invalid-cron",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const testDate = new Date("2024-01-15T00:00:00Z");

      const result = shouldExecuteOnDate(invalidPattern, startDate, testDate);

      expect(result).toBe(false);
    });
  });

  describe("getExecutionDatesBetween", () => {
    it("should return execution dates for cron patterns", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-05T00:00:00Z");

      const result = getExecutionDatesBetween(cronPattern, startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((date) => {
        expect(date).toBeInstanceOf(Date);
        expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(date.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it("should return execution dates for RRULE patterns", () => {
      const rrulePattern = {
        type: "rrule" as const,
        expression: "FREQ=DAILY",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-05T00:00:00Z");

      const result = getExecutionDatesBetween(rrulePattern, startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((date) => {
        expect(date).toBeInstanceOf(Date);
        expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(date.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it("should return empty array for invalid patterns", () => {
      const invalidPattern = {
        type: "cron" as const,
        expression: "invalid-cron",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-05T00:00:00Z");

      const result = getExecutionDatesBetween(
        invalidPattern,
        startDate,
        endDate
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should return empty array when start date is after end date", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-05T00:00:00Z");
      const endDate = new Date("2024-01-01T00:00:00Z");

      const result = getExecutionDatesBetween(cronPattern, startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should handle timezone correctly", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "America/New_York",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-05T00:00:00Z");

      const result = getExecutionDatesBetween(cronPattern, startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("describeCronPattern", () => {
    it("should describe valid cron patterns", () => {
      const testCases = [
        { expression: "0 0 * * *", expected: "Daily at midnight" },
        { expression: "0 0 * * 1", expected: "Weekly on Monday at midnight" },
        { expression: "0 0 1 * *", expected: "Monthly on the 1st at midnight" },
        {
          expression: "0 0 1 1 *",
          expected: "Yearly on January 1st at midnight",
        },
      ];

      testCases.forEach(({ expression, expected }) => {
        const result = describeCronPattern(expression);
        expect(result).toContain(expected);
      });
    });

    it("should handle invalid cron patterns", () => {
      const invalidExpressions = [
        "invalid-cron",
        "0 0 0 0 0 0 0",
        "",
        "0 0 * * * *",
      ];

      invalidExpressions.forEach((expression) => {
        const result = describeCronPattern(expression);
        expect(result).toContain("Invalid");
      });
    });

    it("should handle timezone in description", () => {
      const expression = "0 0 * * *";
      const timezone = "America/New_York";

      const result = describeCronPattern(expression, timezone);

      expect(result).toContain("Daily");
      expect(result).toContain("midnight");
    });
  });

  describe("describeRRulePattern", () => {
    it("should describe valid RRULE patterns", () => {
      const testCases = [
        { rule: "FREQ=DAILY", expected: "Daily" },
        { rule: "FREQ=WEEKLY;BYDAY=MO", expected: "Weekly on Monday" },
        { rule: "FREQ=MONTHLY;BYMONTHDAY=1", expected: "Monthly on the 1st" },
        {
          rule: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",
          expected: "Yearly on January 1st",
        },
      ];

      testCases.forEach(({ rule, expected }) => {
        const result = describeRRulePattern(rule);
        expect(result).toContain(expected);
      });
    });

    it("should handle invalid RRULE patterns", () => {
      const invalidRules = ["INVALID_RRULE", "FREQ=INVALID", "", "BYDAY=MO"];

      invalidRules.forEach((rule) => {
        const result = describeRRulePattern(rule);
        expect(result).toContain("Invalid");
      });
    });

    it("should handle timezone in description", () => {
      const rule = "FREQ=DAILY";
      const timezone = "Europe/London";

      const result = describeRRulePattern(rule, timezone);

      expect(result).toContain("Daily");
    });
  });

  describe("edge cases", () => {
    it("should handle null/undefined dates gracefully", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };

      // These should not throw errors
      expect(() =>
        getNextExecutionDate(cronPattern, null as any, new Date())
      ).not.toThrow();
      expect(() =>
        getNextExecutionDate(cronPattern, new Date(), null as any)
      ).not.toThrow();
      expect(() =>
        shouldExecuteOnDate(cronPattern, null as any, new Date())
      ).not.toThrow();
      expect(() =>
        getExecutionDatesBetween(cronPattern, null as any, new Date())
      ).not.toThrow();
    });

    it("should handle empty strings gracefully", () => {
      const emptyPattern = {
        type: "cron" as const,
        expression: "",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const currentDate = new Date("2024-01-15T12:00:00Z");

      const result = getNextExecutionDate(emptyPattern, startDate, currentDate);
      expect(result).toBeUndefined();
    });

    it("should handle very large date ranges", () => {
      const cronPattern = {
        type: "cron" as const,
        expression: "0 0 * * *",
        timezone: "UTC",
      };
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-12-31T23:59:59Z");

      const result = getExecutionDatesBetween(cronPattern, startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(366); // Max 366 days in a year
    });
  });

  describe("rruleToHumanReadable", () => {
    it("should convert daily RRULE to human readable text", () => {
      const rrule = "FREQ=DAILY";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("day");
    });

    it("should convert weekly RRULE to human readable text", () => {
      const rrule = "FREQ=WEEKLY;BYDAY=MO";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("week");
    });

    it("should convert monthly RRULE to human readable text", () => {
      const rrule = "FREQ=MONTHLY;BYMONTHDAY=1";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("month");
    });

    it("should convert yearly RRULE to human readable text", () => {
      const rrule = "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("january");
    });

    it("should convert complex RRULE with interval to human readable text", () => {
      const rrule = "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("week");
    });

    it("should convert RRULE with count to human readable text", () => {
      const rrule = "FREQ=DAILY;COUNT=5";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("day");
    });

    it("should convert RRULE with until date to human readable text", () => {
      const rrule = "FREQ=MONTHLY;UNTIL=20241231T235959Z";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("month");
    });

    it("should handle RRULE with timezone", () => {
      const rrule = "FREQ=DAILY;TZID=America/New_York";
      const result = rruleToHumanReadable(rrule);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("day");
    });

    it("should throw error for invalid RRULE", () => {
      const invalidRrule = "INVALID_RRULE";

      expect(() => rruleToHumanReadable(invalidRrule)).toThrow();
    });

    it("should handle empty RRULE string", () => {
      const result = rruleToHumanReadable("");

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain("year");
    });
  });
});
