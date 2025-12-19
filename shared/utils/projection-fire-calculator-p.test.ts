import { describe, it } from "vitest";
import { projectToRetirement } from "./projection-fire-calculator";
import { createDecimalValueString } from "@shared/schema/utils";
import { createRRulePattern } from "./scheduling";
import {
  Contributor,
  FIREProjectionConfig,
  ProjectionConfig,
} from "@shared/schema/projections";

describe("projectToRetirement", () => {
  it("should project to retirement", async () => {
    const fireConfig: FIREProjectionConfig = {
      adjustForInflation: false,
      annualIncomeGoal: createDecimalValueString("100000"),
      dateOfBirth: new Date("1990-01-01"),
      safeWithdrawalRate: 4,
      targetRetirementAge: 60,
      gender: "male",
      includeStatePension: false,
      incomeGoals: [
        {
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
    };

    const contributor: Contributor = {
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
    };

    const result = await projectToRetirement(fireConfig, projectionConfig, [
      contributor,
    ]);

    console.log("result", result);
  });
});
