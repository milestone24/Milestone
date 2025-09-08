import { describe, it, expect } from "vitest";
import { rruleToCron } from "./scheduling";

describe("rruleToCron", () => {
  describe("valid conversions", () => {
    it("should convert daily RRULE to cron", () => {
      const rrule = "FREQ=DAILY";
      const result = rruleToCron(rrule);

      expect(result).toBe("0 0 * * *");
    });

    it("should convert weekly RRULE to cron", () => {
      const testCases = [
        { rrule: "FREQ=WEEKLY;BYDAY=SU", expected: "0 0 * * 0" }, // Sunday
        { rrule: "FREQ=WEEKLY;BYDAY=MO", expected: "0 0 * * 1" }, // Monday
        { rrule: "FREQ=WEEKLY;BYDAY=TU", expected: "0 0 * * 2" }, // Tuesday
        { rrule: "FREQ=WEEKLY;BYDAY=WE", expected: "0 0 * * 3" }, // Wednesday
        { rrule: "FREQ=WEEKLY;BYDAY=TH", expected: "0 0 * * 4" }, // Thursday
        { rrule: "FREQ=WEEKLY;BYDAY=FR", expected: "0 0 * * 5" }, // Friday
        { rrule: "FREQ=WEEKLY;BYDAY=SA", expected: "0 0 * * 6" }, // Saturday
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should convert monthly RRULE to cron", () => {
      const testCases = [
        { rrule: "FREQ=MONTHLY;BYMONTHDAY=1", expected: "0 0 1 * *" },
        { rrule: "FREQ=MONTHLY;BYMONTHDAY=15", expected: "0 0 15 * *" },
        { rrule: "FREQ=MONTHLY;BYMONTHDAY=31", expected: "0 0 31 * *" },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should convert yearly RRULE to cron", () => {
      const testCases = [
        { rrule: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1", expected: "0 0 1 1 *" },
        {
          rrule: "FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15",
          expected: "0 0 15 6 *",
        },
        {
          rrule: "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31",
          expected: "0 0 31 12 *",
        },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should convert nth day of month RRULE to cron", () => {
      const testCases = [
        { rrule: "FREQ=MONTHLY;BYDAY=1TU", expected: "0 0 * * 2#1" }, // 1st Tuesday
        { rrule: "FREQ=MONTHLY;BYDAY=2TU", expected: "0 0 * * 2#2" }, // 2nd Tuesday
        { rrule: "FREQ=MONTHLY;BYDAY=3TU", expected: "0 0 * * 2#3" }, // 3rd Tuesday
        { rrule: "FREQ=MONTHLY;BYDAY=4TU", expected: "0 0 * * 2#4" }, // 4th Tuesday
        { rrule: "FREQ=MONTHLY;BYDAY=1MO", expected: "0 0 * * 1#1" }, // 1st Monday
        { rrule: "FREQ=MONTHLY;BYDAY=3FR", expected: "0 0 * * 5#3" }, // 3rd Friday
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });
  });

  describe("invalid conversions", () => {
    it("should return null for invalid RRULE format", () => {
      const invalidRrules = [
        "INVALID_RRULE",
        "FREQ=INVALID",
        "FREQ=",
        "BYDAY=MO", // Missing FREQ
        "FREQ=DAILY;INVALID_PARAM=value",
        "", // Empty string
        "FREQ=WEEKLY;BYDAY=INVALID",
        "FREQ=MONTHLY;BYMONTHDAY=32",
        "FREQ=YEARLY;BYMONTH=13",
      ];

      invalidRrules.forEach((rrule) => {
        const result = rruleToCron(rrule);
        expect(result).toBeNull();
      });
    });

    it("should return null for RRULE with interval", () => {
      const intervalRrules = [
        "FREQ=DAILY;INTERVAL=2",
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
        "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
        "FREQ=YEARLY;INTERVAL=2;BYMONTH=1;BYMONTHDAY=1",
      ];

      intervalRrules.forEach((rrule) => {
        const result = rruleToCron(rrule);
        expect(result).toBeNull();
      });
    });

    it("should return null for RRULE with multiple days", () => {
      const multipleDayRrules = [
        "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        "FREQ=MONTHLY;BYDAY=1MO,2TU",
        "FREQ=YEARLY;BYDAY=1MO,1TU",
      ];

      multipleDayRrules.forEach((rrule) => {
        const result = rruleToCron(rrule);
        expect(result).toBeNull();
      });
    });

    it("should return null for RRULE with count or until", () => {
      const limitedRrules = [
        "FREQ=DAILY;COUNT=5",
        "FREQ=WEEKLY;BYDAY=MO;COUNT=10",
        "FREQ=MONTHLY;BYMONTHDAY=1;UNTIL=20241231T235959Z",
      ];

      limitedRrules.forEach((rrule) => {
        const result = rruleToCron(rrule);
        expect(result).toBeNull();
      });
    });

    it("should return null for RRULE with negative day of month", () => {
      const negativeDayRrules = [
        "FREQ=MONTHLY;BYMONTHDAY=-1", // Last day of month
        "FREQ=MONTHLY;BYMONTHDAY=-5", // 5th from last
      ];

      negativeDayRrules.forEach((rrule) => {
        const result = rruleToCron(rrule);
        expect(result).toBeNull();
      });
    });

    it("should return null for RRULE with multiple months", () => {
      const multipleMonthRrules = [
        "FREQ=YEARLY;BYMONTH=1,6,12;BYMONTHDAY=1",
        "FREQ=MONTHLY;BYMONTH=1,3,5;BYMONTHDAY=15",
      ];

      multipleMonthRrules.forEach((rrule) => {
        const result = rruleToCron(rrule);
        expect(result).toBeNull();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace in RRULE", () => {
      const rrule = "  FREQ=DAILY  "; // Extra whitespace
      const result = rruleToCron(rrule);

      expect(result).toBe("0 0 * * *");
    });

    it("should handle case insensitive RRULE", () => {
      const testCases = [
        { rrule: "freq=daily", expected: "0 0 * * *" },
        { rrule: "FREQ=WEEKLY;byday=MO", expected: "0 0 * * 1" },
        { rrule: "Freq=Monthly;ByMonthDay=1", expected: "0 0 1 * *" },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should handle RRULE with extra semicolons", () => {
      const rrule = "FREQ=DAILY;;"; // Extra semicolons
      const result = rruleToCron(rrule);

      expect(result).toBe("0 0 * * *");
    });

    it("should handle RRULE with extra parameters", () => {
      const rrule = "FREQ=DAILY;DTSTART=20240101T000000Z"; // Extra DTSTART
      const result = rruleToCron(rrule);

      expect(result).toBe("0 0 * * *");
    });
  });

  describe("boundary values", () => {
    it("should handle valid day of month values", () => {
      const testCases = [
        { rrule: "FREQ=MONTHLY;BYMONTHDAY=1", expected: "0 0 1 * *" },
        { rrule: "FREQ=MONTHLY;BYMONTHDAY=15", expected: "0 0 15 * *" },
        { rrule: "FREQ=MONTHLY;BYMONTHDAY=31", expected: "0 0 31 * *" },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should handle valid month values", () => {
      const testCases = [
        { rrule: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1", expected: "0 0 1 1 *" },
        { rrule: "FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=1", expected: "0 0 1 6 *" },
        {
          rrule: "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=1",
          expected: "0 0 1 12 *",
        },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should handle valid day of week values", () => {
      const testCases = [
        { rrule: "FREQ=WEEKLY;BYDAY=SU", expected: "0 0 * * 0" },
        { rrule: "FREQ=WEEKLY;BYDAY=WE", expected: "0 0 * * 3" },
        { rrule: "FREQ=WEEKLY;BYDAY=SA", expected: "0 0 * * 6" },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });

    it("should handle valid nth day values", () => {
      const testCases = [
        { rrule: "FREQ=MONTHLY;BYDAY=1TU", expected: "0 0 * * 2#1" },
        { rrule: "FREQ=MONTHLY;BYDAY=2TU", expected: "0 0 * * 2#2" },
        { rrule: "FREQ=MONTHLY;BYDAY=3TU", expected: "0 0 * * 2#3" },
        { rrule: "FREQ=MONTHLY;BYDAY=4TU", expected: "0 0 * * 2#4" },
      ];

      testCases.forEach(({ rrule, expected }) => {
        const result = rruleToCron(rrule);
        expect(result).toBe(expected);
      });
    });
  });

  describe("return value types", () => {
    it("should return string for valid conversions", () => {
      const rrule = "FREQ=DAILY";
      const result = rruleToCron(rrule);

      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d+ \d+ [\d\*]+ [\d\*]+ [\d\*]+$/);
    });

    it("should return null for invalid conversions", () => {
      const rrule = "INVALID_RRULE";
      const result = rruleToCron(rrule);

      expect(result).toBeNull();
    });
  });
});
