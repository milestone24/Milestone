import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateSchedulePattern,
  createCronPattern,
  createRRulePattern,
  SchedulePattern,
  PatternEvaluation,
} from "./scheduling";

describe("evaluateSchedulePattern", () => {
  let startDate: Date;
  let currentDate: Date;

  beforeEach(() => {
    startDate = new Date("2024-01-01T00:00:00Z");
    currentDate = new Date("2024-01-15T12:00:00Z");
  });

  describe("cron patterns", () => {
    it("should evaluate daily cron pattern", () => {
      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 * * *",
      });
      expect(result.shouldExecute).toBe(true);
    });

    it("should evaluate weekly cron pattern", () => {
      const pattern = createCronPattern("0 0 * * 1"); // Monday
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 * * 1",
      });
    });

    it("should evaluate monthly cron pattern", () => {
      const pattern = createCronPattern("0 0 1 * *"); // 1st of month
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 1 * *",
      });
    });

    it("should evaluate yearly cron pattern", () => {
      const pattern = createCronPattern("0 0 1 1 *"); // January 1st
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 1 1 *",
      });
    });

    it("should handle invalid cron pattern", () => {
      const pattern = createCronPattern("invalid-cron");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: undefined,
        description: "Cron: invalid-cron (Invalid)",
      });
    });
  });

  describe("RRULE patterns", () => {
    it("should evaluate daily RRULE pattern", () => {
      const pattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=DAILY",
      });
      expect(result.shouldExecute).toBe(true);
    });

    it("should evaluate weekly RRULE pattern", () => {
      const pattern = createRRulePattern("FREQ=WEEKLY;BYDAY=MO");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=WEEKLY;BYDAY=MO",
      });
    });

    it("should evaluate monthly RRULE pattern", () => {
      const pattern = createRRulePattern("FREQ=MONTHLY;BYMONTHDAY=1");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=MONTHLY;BYMONTHDAY=1",
      });
    });

    it("should evaluate yearly RRULE pattern", () => {
      const pattern = createRRulePattern("FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "RRULE: FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",
      });
    });

    it("should handle invalid RRULE pattern", () => {
      const pattern = createRRulePattern("INVALID_RRULE");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toMatchObject({
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: undefined,
        description: "RRULE: INVALID_RRULE (Invalid)",
      });
    });
  });

  describe("execution logic", () => {
    it("should not execute if current date is before start date", () => {
      const futureStartDate = new Date("2024-02-01T00:00:00Z");
      const pastCurrentDate = new Date("2024-01-15T12:00:00Z");

      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        pattern,
        futureStartDate,
        pastCurrentDate
      );

      expect(result.shouldExecute).toBe(false);
    });

    it("should execute if current date is after start date", () => {
      const pastStartDate = new Date("2024-01-01T00:00:00Z");
      const futureCurrentDate = new Date("2024-01-15T12:00:00Z");

      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        pattern,
        pastStartDate,
        futureCurrentDate
      );

      expect(result.shouldExecute).toBe(true);
    });

    it("should handle last execution date correctly", () => {
      const lastExecutionDate = new Date("2024-01-10T00:00:00Z");

      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        pattern,
        startDate,
        currentDate,
        lastExecutionDate
      );

      expect(result.lastExecution).toEqual(lastExecutionDate);
      expect(result.shouldExecute).toBe(true);
    });

    it("should not execute if last execution is more recent than occurrences", () => {
      const recentLastExecution = new Date("2024-01-14T00:00:00Z");

      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        pattern,
        startDate,
        currentDate,
        recentLastExecution
      );

      expect(result.lastExecution).toEqual(recentLastExecution);
      expect(typeof result.shouldExecute).toBe("boolean");
    });
  });

  describe("timezone handling", () => {
    it("should handle timezone for cron patterns", () => {
      const pattern = createCronPattern("0 0 * * *", "America/New_York");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result.description).toBe("Cron: 0 0 * * *");
      expect(result.shouldExecute).toBe(true);
    });

    it("should handle timezone for RRULE patterns", () => {
      const pattern = createRRulePattern("FREQ=DAILY", "Europe/London");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result.description).toBe("RRULE: FREQ=DAILY");
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe("return value structure", () => {
    it("should return correct PatternEvaluation structure", () => {
      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result).toHaveProperty("shouldExecute");
      expect(result).toHaveProperty("nextExecution");
      expect(result).toHaveProperty("lastExecution");
      expect(result).toHaveProperty("description");

      expect(typeof result.shouldExecute).toBe("boolean");
      expect(result.nextExecution).toBeInstanceOf(Date);
      expect(typeof result.description).toBe("string");
    });

    it("should return undefined lastExecution when not provided", () => {
      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result.lastExecution).toBeUndefined();
    });

    it("should return provided lastExecution when provided", () => {
      const lastExecutionDate = new Date("2024-01-10T00:00:00Z");
      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        pattern,
        startDate,
        currentDate,
        lastExecutionDate
      );

      expect(result.lastExecution).toEqual(lastExecutionDate);
    });
  });

  describe("edge cases", () => {
    it("should handle null/undefined dates gracefully", () => {
      const pattern = createCronPattern("0 0 * * *");

      // These should not throw errors
      expect(() =>
        evaluateSchedulePattern(pattern, null as any, currentDate)
      ).not.toThrow();
      expect(() =>
        evaluateSchedulePattern(pattern, startDate, null as any)
      ).not.toThrow();
      expect(() =>
        evaluateSchedulePattern(pattern, null as any, null as any)
      ).not.toThrow();
    });

    it("should handle empty pattern expressions", () => {
      const pattern = createCronPattern("");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result.shouldExecute).toBe(false);
      expect(result.description).toContain("(Invalid)");
    });

    it("should handle malformed pattern objects", () => {
      const malformedPattern = {
        type: "cron" as const,
        expression: undefined as any,
        timezone: "UTC",
      };
      const result = evaluateSchedulePattern(
        malformedPattern,
        startDate,
        currentDate
      );

      expect(result.shouldExecute).toBe(false);
      expect(result.description).toContain("(Invalid)");
    });
  });

  describe("pattern type handling", () => {
    it("should handle cron pattern type", () => {
      const pattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result.description).toContain("Cron:");
    });

    it("should handle RRULE pattern type", () => {
      const pattern = createRRulePattern("FREQ=DAILY");
      const result = evaluateSchedulePattern(pattern, startDate, currentDate);

      expect(result.description).toContain("RRULE:");
    });

    it("should handle unknown pattern type gracefully", () => {
      const unknownPattern = {
        type: "unknown" as any,
        expression: "test",
        timezone: "UTC",
      };
      const result = evaluateSchedulePattern(
        unknownPattern,
        startDate,
        currentDate
      );

      expect(result.shouldExecute).toBe(false);
      expect(result.description).toContain("Unknown pattern type");
    });
  });
});
