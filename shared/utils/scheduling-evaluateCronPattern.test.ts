import { describe, it, expect, beforeEach } from "vitest";
import { CronPattern, PatternEvaluation } from "./scheduling";

// We need to import the internal function for testing
// Since it's not exported, we'll test it through the public evaluateSchedulePattern function
import { evaluateSchedulePattern, createCronPattern } from "./scheduling";

describe("evaluateCronPattern", () => {
  let testPattern: CronPattern;
  let startDate: Date;
  let currentDate: Date;

  beforeEach(() => {
    startDate = new Date("2024-01-01T00:00:00Z");
    currentDate = new Date("2024-01-15T12:00:00Z");
  });

  describe("valid cron expressions", () => {
    it("should evaluate daily pattern correctly", () => {
      testPattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 * * *",
      });
      expect(result.shouldExecute).toBe(true); // Should execute since it's daily
    });

    it("should evaluate weekly pattern correctly", () => {
      testPattern = createCronPattern("0 0 * * 1"); // Every Monday
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 * * 1",
      });
    });

    it("should evaluate monthly pattern correctly", () => {
      testPattern = createCronPattern("0 0 1 * *"); // 1st of every month
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 1 * *",
      });
    });

    it("should evaluate yearly pattern correctly", () => {
      testPattern = createCronPattern("0 0 1 1 *"); // January 1st
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        lastExecution: undefined,
        description: "Cron: 0 0 1 1 *",
      });
    });

    it("should handle timezone correctly", () => {
      testPattern = createCronPattern("0 0 * * *", "America/New_York");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result.description).toBe("Cron: 0 0 * * *");
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe("invalid cron expressions", () => {
    it("should handle invalid cron expression gracefully", () => {
      testPattern = createCronPattern("invalid-cron");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: undefined,
        description: "Cron: invalid-cron (Invalid)",
      });
    });

    it("should handle malformed cron expression", () => {
      testPattern = createCronPattern("0 0 0 0 0 0 0"); // Too many fields
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: false,
        nextExecution: undefined,
        lastExecution: undefined,
        description: "Cron: 0 0 0 0 0 0 0 (Invalid)",
      });
    });
  });

  describe("execution logic", () => {
    it("should not execute if current date is before start date", () => {
      const futureStartDate = new Date("2024-02-01T00:00:00Z");
      const pastCurrentDate = new Date("2024-01-15T12:00:00Z");

      testPattern = createCronPattern("0 0 * * *");
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

      testPattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        testPattern,
        pastStartDate,
        futureCurrentDate
      );

      expect(result.shouldExecute).toBe(true);
    });

    it("should handle last execution date correctly", () => {
      const lastExecutionDate = new Date("2024-01-10T00:00:00Z");

      testPattern = createCronPattern("0 0 * * *");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate,
        lastExecutionDate
      );

      expect(result.lastExecution).toEqual(lastExecutionDate);
      expect(result.shouldExecute).toBe(true); // Should execute since it's daily and we're past last execution
    });
  });

  describe("edge cases", () => {
    it("should handle empty cron expression", () => {
      testPattern = createCronPattern("");
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result.shouldExecute).toBe(false);
      expect(result.description).toContain("(Invalid)");
    });

    it("should handle cron expression with special characters", () => {
      testPattern = createCronPattern("0 0 * * 2#2"); // 2nd Tuesday of month
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "Cron: 0 0 * * 2#2",
      });
    });

    it("should handle cron expression with ranges", () => {
      testPattern = createCronPattern("0 0 1-5 * *"); // 1st through 5th of month
      const result = evaluateSchedulePattern(
        testPattern,
        startDate,
        currentDate
      );

      expect(result).toMatchObject({
        shouldExecute: expect.any(Boolean),
        nextExecution: expect.any(Date),
        description: "Cron: 0 0 1-5 * *",
      });
    });
  });

  describe("return value structure", () => {
    it("should return correct PatternEvaluation structure", () => {
      testPattern = createCronPattern("0 0 * * *");
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
