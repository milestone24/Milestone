import { describe, it, expect } from "vitest";
import { calculateWithdrawalStrategy } from "./projection-withdrawal";
import {
  Contributor,
  createDecimalValueString,
  ProjectionConfig,
  ProjectionResult,
  ProjectionConfigWithDateRange,
} from "@shared/schema";
import { defineContributorRulesForAssetType } from "./projection-utils-contributor";
import { createRRulePattern } from "./scheduling";

function createProjectionSimpleConfig(): ProjectionConfig {
  return {
    mode: "simple",
    growthModel: "linear",
    interval: "monthly",
    modifiers: [],
    useContributorSpecificGrowthRates: false,
    usePortfolioRecurringContributions: true,
    growthRate: 0,
  };
}

function createProjectionResult(): ProjectionResult {
  const baseConfig = createProjectionSimpleConfig();
  const config: ProjectionConfigWithDateRange = {
    ...baseConfig,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 365 * 24 * 60 * 60 * 1000),
  };
  return {
    config,
    totalCurrentValue: createDecimalValueString("0"),
    totalProjectedValue: createDecimalValueString("0"),
    contributorBreakdown: [],
    computedAt: new Date(),
    timePoints: [],
    totalGrowth: createDecimalValueString("0"),
    totalContributions: createDecimalValueString("0"),
    totalBonuses: createDecimalValueString("0"),
  };
}

describe("calculateWithdrawalStrategy", () => {
  it("should return the correct withdrawal strategy", () => {
    const contributors: Contributor[] = [
      {
        id: crypto.randomUUID(),
        name: "Test Contributor",
        type: "asset",
        currentValue: createDecimalValueString("100000"),
        accountType: "LISA",
        ...defineContributorRulesForAssetType("LISA"),
        schedules: [
          {
            patternConfig: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
            ),
            value: createDecimalValueString("1000"),
            startDate: new Date(),
            endDate: null,
          },
        ],
        includeValue: true,
        includeContributions: true,
      },
    ];

    const withdrawalStrategy = calculateWithdrawalStrategy(
      contributors,
      {
        dateOfBirth: new Date("1979-05-15"),
        includeStatePension: false,
        incomeGoals: [
          {
            key: "retirement_start",
            fromAge: 67,
            incomeGoal: createDecimalValueString("10000"),
          },
        ],
        targetRetirementAge: 67,
        annualIncomeGoal: createDecimalValueString("10000"),
        safeWithdrawalRate: createDecimalValueString("4"),
        adjustForInflation: true,
      },
      createProjectionResult(),
      [
        {
          key: "retirement_start",
          fromAge: 67,
          incomeGoal: createDecimalValueString("10000"),
        },
      ]
    );

    console.log("withdrawalStrategy", withdrawalStrategy);

    expect(withdrawalStrategy).toBeDefined();
  });
});
