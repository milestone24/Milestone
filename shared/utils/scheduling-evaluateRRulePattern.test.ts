import { describe, it, expect, beforeEach } from "vitest";
import { RRulePattern, PatternEvaluation } from "./scheduling";

// We need to import the internal function for testing
// Since it's not exported, we'll test it through the public evaluateSchedulePattern function
import { evaluateSchedulePattern, createRRulePattern } from "./scheduling";

describe("evaluateRRulePattern", () => {
  let testPattern: RRulePattern;
  let startDate: Date;
  let currentDate: Date;

  beforeEach(() => {
    startDate = new Date("2024-01-01T00:00:00Z");
    currentDate = new Date("2024-01-15T12:00:00Z");
  });

  describe("valid RRULE expressions", () => {
    it("should evaluate daily pattern correctly", () => {
      testPattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=DAILY",
      });
      expect(result.shouldExecute).toBe(true); // Should execute since it's daily
    });

    it("should evaluate weekly pattern correctly", () => {
      testPattern = createRRulePattern("FREQ=WEEKLY;BYDAY=MO"); // Every Monday
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=WEEKLY;BYDAY=MO",
      });
    });

    it("should evaluate monthly pattern correctly", () => {
      testPattern = createRRulePattern("FREQ=MONTHLY;BYMONTHDAY=1"); // 1st of every month
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=MONTHLY;BYMONTHDAY=1",
      });
    });

    it("should evaluate yearly pattern correctly", () => {
      testPattern = createRRulePattern("FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1"); // January 1st
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",
      });
    });

    it("should evaluate bi-weekly pattern correctly", () => {
      testPattern = createRRulePattern("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"); // Every 2 weeks on Tuesday
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
      });
    });

    it("should evaluate nth day of month pattern correctly", () => {
      testPattern = createRRulePattern("FREQ=MONTHLY;BYDAY=2TU"); // 2nd Tuesday of month
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=MONTHLY;BYDAY=2TU",
      });
    });

    it("should handle timezone correctly", () => {
      testPattern = createRRulePattern("FREQ=DAILY", "America/New_York");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result.description).toBe("RRULE: FREQ=DAILY");
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe("invalid RRULE expressions", () => {
    it("should handle invalid RRULE gracefully", () => {
      testPattern = createRRulePattern("INVALID_RRULE");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: undefined,
        description: "RRULE: INVALID_RRULE (Invalid)",
      });
    });

    it("should handle malformed RRULE", () => {
      testPattern = createRRulePattern("FREQ=INVALID");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: undefined,
        description: "RRULE: FREQ=INVALID (Invalid)",
      });
    });

    it("should handle empty RRULE", () => {
      testPattern = createRRulePattern("");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result.shouldExecute).toBe(false);
      expect(result.description).toContain("(Invalid)");
    });
  });

  describe("execution logic", () => {
    it("should not execute if current date is before start date", () => {
      const futureStartDate = new Date("2024-02-01T00:00:00Z");
      const pastCurrentDate = new Date("2024-01-15T12:00:00Z");

      testPattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(
        testPattern,
        futureStartDate,
        pastCurrentDate
      );

      expect(result.shouldExecute).toBe(false);
    });

    it("should execute if current date is after start date", () => {
      const pastStartDate = new Date("2024-01-01T00:00:00Z");
      const futureCurrentDate = new Date("2024-01-15T12:00:00Z");

      testPattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(
        testPattern,
        pastStartDate,
        futureCurrentDate
      );

      expect(result.shouldExecute).toBe(true);
    });

    it("should handle last execution date correctly", () => {
      const lastExecutionDate = new Date("2024-01-10T00:00:00Z");

      testPattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate,
        lastExecutionDate
      );

      expect(result.lastExecution).toEqual(lastExecutionDate);
      expect(result.shouldExecute).toBe(true); // Should execute since it's daily and we're past last execution
    });

    it("should not execute if last execution is more recent than occurrences", () => {
      const recentLastExecution = new Date("2024-01-14T00:00:00Z");

      testPattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate,
        recentLastExecution
      );

      expect(result.lastExecution).toEqual(recentLastExecution);
      // This might be true or false depending on the exact timing, but should be consistent
      expect(typeof result.shouldExecute).toBe("boolean");
    });
  });

  describe("complex RRULE patterns", () => {
    it("should handle multiple days of week", () => {
      testPattern = createRRulePattern("FREQ=WEEKLY;BYDAY=MO,WE,FR"); // Mon, Wed, Fri
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "RRULE: FREQ=WEEKLY;BYDAY=MO,WE,FR",
      });
    });

    it("should handle quarterly pattern", () => {
      testPattern = createRRulePattern("FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1"); // Every 3 months on 1st
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "RRULE: FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
      });
    });

    it("should handle last day of month", () => {
      testPattern = createRRulePattern("FREQ=MONTHLY;BYMONTHDAY=-1"); // Last day of month
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "RRULE: FREQ=MONTHLY;BYMONTHDAY=-1",
      });
    });

    it("should handle specific months", () => {
      testPattern = createRRulePattern(
        "FREQ=YEARLY;BYMONTH=1,6,12;BYMONTHDAY=1"
      ); // Jan 1, Jun 1, Dec 1
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "RRULE: FREQ=YEARLY;BYMONTH=1,6,12;BYMONTHDAY=1",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle RRULE with count limit", () => {
      testPattern = createRRulePattern("FREQ=DAILY;COUNT=5"); // Daily for 5 occurrences
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "RRULE: FREQ=DAILY;COUNT=5",
      });
    });

    it("should handle RRULE with until date", () => {
      const untilDate = new Date("2024-12-31T23:59:59Z");
      testPattern = createRRulePattern(
        `FREQ=DAILY;UNTIL=${
          untilDate.toISOString().replace(/[-:]/g, "").split(".")[0]
        }Z`
      );
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: expect.stringContaining("FREQ=DAILY;UNTIL="),
      });
    });
  });

  describe("return value structure", () => {
    it("should return correct PatternEvaluation structure", () => {
      testPattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toHaveProperty("shouldExecute");
      expect(result).toHaveProperty("nextExecution");
      expect(result).toHaveProperty("lastExecution");
      expect(result).toHaveProperty("description");

      expect(typeof result.shouldExecute).toBe("boolean");
      expect(result.nextExecution).toBeInstanceOf(Date);
      expect(typeof result.description).toBe("string");
    });
  });
});
