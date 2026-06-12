import { describe, it } from "vitest";
import { projectToRetirement } from "./projection-fire-calculator";
import { createDecimalValueString } from "../schema/decimal-value";
import { createRRulePattern } from "./scheduling";
import {
  Contributor,
  FIREProjectionConfig,
  ProjectionConfig,
} from "../schema/projections";
import { addDays } from "date-fns";
describe("projectToRetirement", () => {

  it.only("should preject to retirement with basic setup", async () => {

    const startDate = addDays(new Date(), -30);

    const fireConfig: FIREProjectionConfig = {
      adjustForInflation: false,



      dateOfBirth: new Date("1990-01-01"),
      safeWithdrawalRate: createDecimalValueString("4"),

      //Do we need annualIncomeGoal and targetRetirementAge now we have income goals
      annualIncomeGoal: createDecimalValueString("100000"),
      targetRetirementAge: 60,

      includeStatePension: false,
      incomeGoals: [
        {
          key: "retirement_start",
          fromAge: 60,
          incomeGoal: createDecimalValueString("100000"),
        },
      ],
    };

    const projectionConfig: ProjectionConfig = {
      mode: "simple",
      growthRate: 7.0,
      useContributorSpecificGrowthRates: false,
      growthModel: "linear",
      interval: "yearly",
      modifiers: [],
      usePortfolioRecurringContributions: true,
    };

    const contributor: Contributor = {
      id: crypto.randomUUID(),
      accountType: "ISA",
      currentValue: createDecimalValueString("0"),
      name: "ISA",
      type: "asset",
      schedules: [
        {
          value: createDecimalValueString("1000"),
          patternConfig: {
            type: "rrule",
            expression: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
            ).expression,
          },
          startDate: startDate,
          endDate: new Date(),
        },
      ],
      includeValue: true,
      includeContributions: true,
    };

    const result = await projectToRetirement(fireConfig, projectionConfig, [
      contributor,
    ]);

    const { fireProjectionByTime, fireProjectionByAge, projectionResult, ...rest } = result;

    const { timePoints, ...restp } = projectionResult;

    console.log("result", rest);

    console.log("projectionResult", restp);

  });


  it("should project to retirement", async () => {
    const fireConfig: FIREProjectionConfig = {
      adjustForInflation: false,
      annualIncomeGoal: createDecimalValueString("100000"),
      dateOfBirth: new Date("1990-01-01"),
      safeWithdrawalRate: createDecimalValueString("4"),
      targetRetirementAge: 60,
      includeStatePension: false,
      incomeGoals: [
        {
          key: "retirement_start",
          fromAge: 60,
          incomeGoal: createDecimalValueString("100000"),
        },
      ],
    };

    const projectionConfig: ProjectionConfig = {
      mode: "simple",
      growthRate: 7.0,
      useContributorSpecificGrowthRates: false,
      growthModel: "linear",
      interval: "yearly",
      modifiers: [],
      usePortfolioRecurringContributions: true,
    };

    const contributor: Contributor = {
      id: crypto.randomUUID(),
      accountType: "LISA",
      currentValue: createDecimalValueString("100000.50"),
      name: "LISA",
      type: "asset",
      valueReleases: [
        {
          valueType: "age",
          value: "60",
          penalties: [
            {
              rule: {
                comparator: "lt",
                value: "60",
              },
              penalty: {
                valueType: "percentage",
                value: createDecimalValueString("0.25"),
              },
            },
          ],
        },
      ],
      bonusValues: [
        {
          name: "LISA Bonus",
          valueType: "percentage",
          value: createDecimalValueString("0.25"),
          annualLimit: createDecimalValueString("1000"), // 25% of £4,000
          annualContributionLimit: createDecimalValueString("4000"),
        },
      ],
      schedules: [
        {
          value: createDecimalValueString("1000"),
          patternConfig: {
            type: "rrule",
            expression: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
            ).expression,
          },
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-12-31"),
        },
      ],
      includeValue: true,
      includeContributions: true,
    };

    const result = await projectToRetirement(fireConfig, projectionConfig, [
      contributor,
    ]);

    console.log("result", result);
  });
});
