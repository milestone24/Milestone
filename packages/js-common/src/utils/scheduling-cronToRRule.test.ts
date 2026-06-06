import { describe, it, expect } from "vitest";
import { cronToRRule } from "./scheduling";

describe("cronToRRule", () => {
  describe("valid conversions", () => {
    it("should convert daily cron to RRULE", () => {
      const cron = "0 0 * * *";
      const result = cronToRRule(cron);

      expect(result).toBe("FREQ=DAILY");
    });

    it("should convert weekly cron to RRULE", () => {
      const testCases = [
        { cron: "0 0 * * 0", expected: "FREQ=WEEKLY;BYDAY=SU" }, // Sunday
        { cron: "0 0 * * 1", expected: "FREQ=WEEKLY;BYDAY=MO" }, // Monday
        { cron: "0 0 * * 2", expected: "FREQ=WEEKLY;BYDAY=TU" }, // Tuesday
        { cron: "0 0 * * 3", expected: "FREQ=WEEKLY;BYDAY=WE" }, // Wednesday
        { cron: "0 0 * * 4", expected: "FREQ=WEEKLY;BYDAY=TH" }, // Thursday
        { cron: "0 0 * * 5", expected: "FREQ=WEEKLY;BYDAY=FR" }, // Friday
        { cron: "0 0 * * 6", expected: "FREQ=WEEKLY;BYDAY=SA" }, // Saturday
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });

    it("should convert monthly cron to RRULE", () => {
      const testCases = [
        { cron: "0 0 1 * *", expected: "FREQ=MONTHLY;BYMONTHDAY=1" },
        { cron: "0 0 15 * *", expected: "FREQ=MONTHLY;BYMONTHDAY=15" },
        { cron: "0 0 31 * *", expected: "FREQ=MONTHLY;BYMONTHDAY=31" },
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });

    it("should convert yearly cron to RRULE", () => {
      const testCases = [
        { cron: "0 0 1 1 *", expected: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1" },
        { cron: "0 0 15 6 *", expected: "FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15" },
        {
          cron: "0 0 31 12 *",
          expected: "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31",
        },
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });

    it("should convert nth day of month cron to RRULE", () => {
      const testCases = [
        { cron: "0 0 * * 2#1", expected: "FREQ=MONTHLY;BYDAY=1TU" }, // 1st Tuesday
        { cron: "0 0 * * 2#2", expected: "FREQ=MONTHLY;BYDAY=2TU" }, // 2nd Tuesday
        { cron: "0 0 * * 2#3", expected: "FREQ=MONTHLY;BYDAY=3TU" }, // 3rd Tuesday
        { cron: "0 0 * * 2#4", expected: "FREQ=MONTHLY;BYDAY=4TU" }, // 4th Tuesday
        { cron: "0 0 * * 1#1", expected: "FREQ=MONTHLY;BYDAY=1MO" }, // 1st Monday
        { cron: "0 0 * * 5#3", expected: "FREQ=MONTHLY;BYDAY=3FR" }, // 3rd Friday
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });
  });

  describe("invalid conversions", () => {
    it("should return null for invalid cron format", () => {
      const invalidCrons = [
        "invalid-cron",
        "0 0 0 0 0 0 0", // Too many fields
        "0 0 0 0 0", // Too few fields
        "0 0 * *", // Missing field
        "", // Empty string
        "0 0 * * * *", // Too many fields
      ];

      invalidCrons.forEach((cron) => {
        const result = cronToRRule(cron);
        expect(result).toBeNull();
      });
    });

    it("should return null for cron with non-zero time", () => {
      const timeBasedCrons = [
        "30 0 * * *", // 30 minutes past midnight
        "0 9 * * *", // 9 AM
        "15 14 * * *", // 2:15 PM
        "0 23 * * *", // 11 PM
      ];

      timeBasedCrons.forEach((cron) => {
        const result = cronToRRule(cron);
        expect(result).toBeNull();
      });
    });

    it("should return null for complex cron patterns", () => {
      const complexCrons = [
        "0 0 1-5 * *", // Range of days
        "0 0 1,15 * *", // List of days
        "0 0 */2 * *", // Every 2 days
        "0 0 * * 1-5", // Weekdays
        "0 0 * * 1,3,5", // Multiple days of week
        "0 0 1 1,6,12 *", // Multiple months
        "0 0 L * *", // Last day of month
      ];

      complexCrons.forEach((cron) => {
        const result = cronToRRule(cron);
        expect(result).toBeNull();
      });
    });

    it("should return null for cron with invalid day of week", () => {
      const invalidDayCrons = [
        "0 0 * * 7", // Invalid day (7)
        "0 0 * * 8", // Invalid day (8)
        "0 0 * * -1", // Invalid day (-1)
      ];

      invalidDayCrons.forEach((cron) => {
        const result = cronToRRule(cron);
        expect(result).toBeNull();
      });
    });

    it("should return null for cron with invalid nth day format", () => {
      const invalidNthDayCrons = [
        "0 0 * * 2#0", // Invalid nth (0)
        "0 0 * * 2#5", // Invalid nth (5)
        "0 0 * * 2#", // Missing nth
        "0 0 * * #2", // Missing day
        "0 0 * * 2#A", // Non-numeric nth
      ];

      invalidNthDayCrons.forEach((cron) => {
        const result = cronToRRule(cron);
        expect(result).toBeNull();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace in cron expressions", () => {
      const cron = "  0  0  *  *  *  "; // Extra whitespace
      const result = cronToRRule(cron);

      expect(result).toBe("FREQ=DAILY");
    });

    it("should handle tabs in cron expressions", () => {
      const cron = "0\t0\t*\t*\t*"; // Tab-separated
      const result = cronToRRule(cron);

      expect(result).toBe("FREQ=DAILY");
    });

    it("should handle mixed whitespace", () => {
      const cron = "0 0\t* * *"; // Mixed spaces and tabs
      const result = cronToRRule(cron);

      expect(result).toBe("FREQ=DAILY");
    });

    it("should handle cron expressions with leading/trailing whitespace", () => {
      const cron = "\n 0 0 * * * \n "; // Newlines and spaces
      const result = cronToRRule(cron);

      expect(result).toBe("FREQ=DAILY");
    });
  });

  describe("boundary values", () => {
    it("should handle valid day of month values", () => {
      const testCases = [
        { cron: "0 0 1 * *", expected: "FREQ=MONTHLY;BYMONTHDAY=1" },
        { cron: "0 0 15 * *", expected: "FREQ=MONTHLY;BYMONTHDAY=15" },
        { cron: "0 0 31 * *", expected: "FREQ=MONTHLY;BYMONTHDAY=31" },
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });

    it("should handle valid month values", () => {
      const testCases = [
        { cron: "0 0 1 1 *", expected: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1" },
        { cron: "0 0 1 6 *", expected: "FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=1" },
        { cron: "0 0 1 12 *", expected: "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=1" },
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });

    it("should handle valid day of week values", () => {
      const testCases = [
        { cron: "0 0 * * 0", expected: "FREQ=WEEKLY;BYDAY=SU" },
        { cron: "0 0 * * 3", expected: "FREQ=WEEKLY;BYDAY=WE" },
        { cron: "0 0 * * 6", expected: "FREQ=WEEKLY;BYDAY=SA" },
      ];

      testCases.forEach(({ cron, expected }) => {
        const result = cronToRRule(cron);
        expect(result).toBe(expected);
      });
    });
  });

  describe("return value types", () => {
    it("should return string for valid conversions", () => {
      const cron = "0 0 * * *";
      const result = cronToRRule(cron);

      expect(typeof result).toBe("string");
      expect(result).toContain("FREQ=");
    });

    it("should return null for invalid conversions", () => {
      const cron = "invalid-cron";
      const result = cronToRRule(cron);

      expect(result).toBeNull();
    });
  });
});
