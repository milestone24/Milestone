import { describe, it, expect, beforeEach } from "vitest";
import { calculateYearsAheadOrBehind, calculateYearsToTarget } from "./projection-utils";
import { createDecimalValueString } from "@shared/schema/decimal-value";
import type { Contributor, ContributorSchedule } from "@shared/schema/projections";
import { createRRulePattern } from "./scheduling";
import { createModifierChain, ModifierChain } from "./projection-modifiers";

// describe("calculateYearsAheadOrBehind should return the correct number of years ahead or behind", () => {

//   let modifierChain: ModifierChain;

//   beforeEach(() => {
//     modifierChain = createModifierChain([]);
//   });

//   it("when portfolio will reach target exactly at retirement age returns 0", () => {
//     const currentPortfolioValue = createDecimalValueString("500000");
//     const targetValue = createDecimalValueString("1000000");
//     const targetRetirementAge = 65;
//     const currentAge = 60;
//     const annualGrowthRate = 7;

//     // Monthly contribution that will reach target in 5 years with 7% growth
//     // This is a simplified test - actual calculation would need precise contribution amount
//     const scheduledContributions: ContributorSchedule[] = [
//       {
//         patternConfig: {
//           type: "cron",
//           expression: "0 0 1 * *", // Monthly on 1st
//         },
//         value: createDecimalValueString("1000"), // Example monthly contribution
//         startDate: new Date(),
//         endDate: null,
//       },
//     ];

//     const yearsToTarget = calculateYearsToTarget(
//       currentPortfolioValue,
//       contributors,
//       annualGrowthRate,
//       targetValue,
//       modifierChain,
//       {
//         startDate: new Date(),
//         maxYears: 100,

//     const yearsAheadOrBehind = calculateYearsAheadOrBehind(
//       currentPortfolioValue,
//       targetValue,
//       scheduledContributions,
//       annualGrowthRate,
//       targetRetirementAge,
//       currentAge
//     );

//     // The result depends on the actual calculation, but should be close to 0
//     // when contributions are set correctly
//     expect(typeof yearsAheadOrBehind).toBe("number");
//     expect(
//       Number.isFinite(yearsAheadOrBehind) || yearsAheadOrBehind === Infinity
//     ).toBe(true);
//   });

//   it("when portfolio cannot reach target returns Infinity", () => {
//     const currentPortfolioValue = createDecimalValueString("100000");
//     const targetValue = createDecimalValueString("10000000"); // Very high target
//     const targetRetirementAge = 65;
//     const currentAge = 60;
//     const annualGrowthRate = 7;

//     // No contributions - impossible to reach target
//     const scheduledContributions: ContributorSchedule[] = [];

//     const yearsAheadOrBehind = calculateYearsAheadOrBehind(
//       currentPortfolioValue,
//       targetValue,
//       scheduledContributions,
//       annualGrowthRate,
//       targetRetirementAge,
//       currentAge
//     );

//     expect(yearsAheadOrBehind).toBe(Infinity);
//   });

//   it("when portfolio will reach target before retirement age returns negative (ahead)", () => {
//     const currentPortfolioValue = createDecimalValueString("800000");
//     const targetValue = createDecimalValueString("1000000");
//     const targetRetirementAge = 65;
//     const currentAge = 60;
//     const annualGrowthRate = 7;

//     // High monthly contribution that will reach target quickly
//     const scheduledContributions: ContributorSchedule[] = [
//       {
//         patternConfig: {
//           type: "cron",
//           expression: "0 0 1 * *",
//         },
//         value: createDecimalValueString("5000"), // High monthly contribution
//         startDate: new Date(),
//         endDate: null,
//       },
//     ];

//     const yearsAheadOrBehind = calculateYearsAheadOrBehind(
//       currentPortfolioValue,
//       targetValue,
//       scheduledContributions,
//       annualGrowthRate,
//       targetRetirementAge,
//       currentAge
//     );

//     // Should be negative (ahead of schedule)
//     expect(yearsAheadOrBehind).toBeLessThan(0);
//     expect(Number.isFinite(yearsAheadOrBehind)).toBe(true);
//   });

//   it("when portfolio will reach target after retirement age returns positive (behind)", () => {
//     const currentPortfolioValue = createDecimalValueString("100000");
//     const targetValue = createDecimalValueString("1000000");
//     const targetRetirementAge = 65;
//     const currentAge = 60;
//     const annualGrowthRate = 7;

//     // Low monthly contribution that won't reach target in time
//     const scheduledContributions: ContributorSchedule[] = [
//       {
//         patternConfig: {
//           type: "cron",
//           expression: "0 0 1 * *",
//         },
//         value: createDecimalValueString("100"), // Low monthly contribution
//         startDate: new Date(),
//         endDate: null,
//       },
//     ];

//     const yearsAheadOrBehind = calculateYearsAheadOrBehind(
//       currentPortfolioValue,
//       targetValue,
//       scheduledContributions,
//       annualGrowthRate,
//       targetRetirementAge,
//       currentAge
//     );

//     // Should be positive (behind schedule) or Infinity if unreachable
//     expect(yearsAheadOrBehind >= 0 || yearsAheadOrBehind === Infinity).toBe(
//       true
//     );
//   });
// });


describe.only("calculateYearsAheadOrBehind foo", () => {
  it("should return the correct number of years ahead or behind", () => {
    const currentPortfolioValue = createDecimalValueString("7152.93");
    const targetValue = createDecimalValueString("1000000");
    const targetRetirementAge = 54;
    const currentAge = 46;
    const annualGrowthRate = 7;

    const c: Contributor[] = [
      {
        id: "88652df0-34f3-4638-9148-30edfb2e5b09",
        referenceId: "03091e4b-9422-45b2-8ebc-af0c4b094afa",
        accountType: "ISA",
        name: "account--DUO8A66",
        type: "asset",
        currentValue: createDecimalValueString("7152.93"),
        schedules: [],
        valueReleases: [
          {
            value: "60",
            valueType: "age",
            penalties: [
              {
                rule: {
                  comparator: "lt",
                  value: "60"
                },
                penalty: {
                  valueType: "percentage",
                  value: createDecimalValueString("0.25")
                }
              }
            ],
          }
        ],
        bonusValues: [
          {
            name: "LISA",
            valueType: "percentage",
            value: createDecimalValueString("0.25"),
            annualLimit: createDecimalValueString("1000"),
            annualContributionLimit: createDecimalValueString("4000"),
            priority: 1
          }
        ],
        taxes: [],
        expectedGrowthRate: 7,
        includeValue: true,
        includeContributions: false
      },
      {
        id: "fe9596fb-7c71-4991-9b85-224fb6caaf40",
        name: "Fire Settings Monthly Contribution",
        type: "fire-setting",
        accountType: "OTHER",
        currentValue: createDecimalValueString("0"),
        schedules: [
          {
            startDate: new Date("2026-02-09T06:44:47.021Z"),
            endDate: null,
            value: createDecimalValueString("1000000.00"),
            patternConfig: {
              type: "rrule",
              expression: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1").expression,
            }
          }
        ],
        includeValue: true,
        includeContributions: true
      },
      {
        id: "e8c953d5-6329-44c1-9c87-cb4a6381ad9c",
        name: "State Pension",
        type: "state_pension",
        currentValue: createDecimalValueString("0"),
        accountType: "PENSION",
        expectedGrowthRate: 0,
        valueReleases: [
          {
            value: createDecimalValueString("67"),
            valueType: "age"
          }
        ],
        schedules: [
          {
            patternConfig: {
              type: "rrule",
              expression: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1").expression,
            },
            startDate: new Date("2046-05-15T00:00:00.000Z"),
            endDate: null,
            value: createDecimalValueString("1000")
          }
        ],
        includeValue: true,
        includeContributions: true
      }
    ]

    const modifierChain = createModifierChain([]);

    const yearsToTarget = calculateYearsToTarget(
      currentPortfolioValue,
      c,
      annualGrowthRate,
      targetValue,
      modifierChain,
      {
        startDate: new Date(),
        maxYears: 100,
      }
    );

    const yearsAheadOrBehind = calculateYearsAheadOrBehind(
      yearsToTarget,
      targetRetirementAge,
      currentAge
    );

    console.log("yearsAheadOrBehind : ", yearsAheadOrBehind);
  });
});