import { calculateMonthlyContributionDifference } from "./projection-utils";
import { describe, it, expect } from "vitest";
import { Contributor } from "../schema/projections";
import { createDecimalValueString } from "../schema/decimal-value";

describe("calculateMonthlyContributionDifference", () => {
  it("should return 0 if the current portfolio value is equal to the target value", async () => {
    const contributors: Contributor[] = [
      {
        id: crypto.randomUUID(),
        name: "Test Contributor",
        type: "asset",
        currentValue: createDecimalValueString("100000.00"),
        accountType: "LISA",
        schedules: [
          {
            patternConfig: {
              type: "rrule",
              expression: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1",
            },
            value: createDecimalValueString("1000.00"),
            startDate: new Date(),
            endDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 1)
            ),
          },
        ],
        includeValue: true,
        includeContributions: true,
      },
    ];
    const totalTargetDifference = 100000;
    const monthsRemaining = 12;
    const annualGrowthRate = 7;
    const result = await calculateMonthlyContributionDifference(
      contributors,
      totalTargetDifference,
      monthsRemaining,
      annualGrowthRate
    );
    console.log("monthlyContributionDifference", result);
    expect(result.monthlyContributionDifference).toBe("0");
  });
});
