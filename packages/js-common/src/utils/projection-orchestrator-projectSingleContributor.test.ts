import { describe, it, expect } from "vitest";
import { projectSingleContributor } from "./projection-orchestrator";
import { createRRulePattern } from "./scheduling";
import {
  Contributor,
  createDecimalValueString,
  DecimalValueString,
  ProjectionConfigWithDateRange,
  ProjectionTimePoint,
} from "../schema";

const expectTimePoint = (
  timePoint: ProjectionTimePoint,
  [
    date,
    value,
    contributions,
    growth,
    bonuses,
    accessibleValue,
    lockedValue,
    projectedValue,
  ]: [
    Date | null,
    DecimalValueString,
    DecimalValueString,
    DecimalValueString,
    DecimalValueString,
    DecimalValueString,
    DecimalValueString,
    boolean
  ]
) => {
  if (date) {
    expect(timePoint.date.toISOString()).toBe(date.toISOString());
  }
  //expect(timePoint.date).toStrictEqual(date);
  expect(timePoint.value).toBe(value);
  expect(timePoint.contributions).toBe(contributions);
  expect(timePoint.growth).toBe(growth);
  expect(timePoint.bonuses).toBe(bonuses);
  expect(timePoint.accessibleValue).toBe(accessibleValue);
  expect(timePoint.lockedValue).toBe(lockedValue);
  expect(timePoint.projectedValue).toBe(projectedValue);
};

describe("projectSingleContributor", () => {
  const startDate = new Date("2025-09-01");
  const endDate = new Date(
    new Date().setFullYear(new Date().getFullYear() + 1)
  );

  console.log("startDate", startDate);
  console.log("endDate", endDate);
  it("should project a single contributor", async () => {
    const contributorOne: Contributor = {
      id: crypto.randomUUID(),
      name: "Test Contributor",
      accountType: "LISA",
      type: "asset",
      currentValue: createDecimalValueString("100000"),
      schedules: [
        {
          patternConfig: createRRulePattern(
            "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
          ),
          value: createDecimalValueString("1000"),
          startDate: startDate,
          endDate: endDate,
        },
      ],
      // limitations: [
      //   {
      //     name: "LISA Limitation",
      //     valueType: "fixed",
      //     predicates: [
      //       {
      //         type: "period",
      //         value: "1y", //What is a standard way to denote periods?, Should we use RRule intervals?
      //       },
      //     ],
      //     value: createDecimalValueString("4000"),
      //   },
      // ],
      valueReleases: [
        {
          valueType: "age",
          value: "68",
          // penalties: [{
          //   rule: {
          //     comparator: "lt",
          //     value: "60",
          //   },
          //   penalty: {
          //     valueType: "percentage",
          //     value: createDecimalValueString("0.25"),
          //   },
          // }],
        },
      ],
      bonusValues: [
        {
          name: "LISA Bonus",
          valueType: "percentage",
          value: createDecimalValueString("0.25"),
          annualLimit: createDecimalValueString("1000"),
          annualContributionLimit: createDecimalValueString("4000"),
        },
      ],
      includeValue: true,
      includeContributions: true,
    };

    const config: ProjectionConfigWithDateRange = {
      mode: "simple",
      growthRate: 7.0,
      growthModel: "linear",
      interval: "yearly",
      modifiers: [],
      startDate: startDate,
      endDate: endDate,
      useContributorSpecificGrowthRates: false,
      usePortfolioRecurringContributions: true,
    };

    const projection = await projectSingleContributor(contributorOne, config);

    console.log("projection", JSON.stringify(projection, null, 2));

    expect(projection).toBeDefined();

    expectTimePoint(projection.timePoints[0]!, [
      startDate,
      createDecimalValueString("100000"),
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      createDecimalValueString("0"),
      createDecimalValueString("100000"),
      createDecimalValueString("0"),
      false,
    ]);
    expectTimePoint(projection.timePoints[1]!, [
      new Date(startDate.setFullYear(startDate.getFullYear() + 1)),
      createDecimalValueString("116000"),
      createDecimalValueString("12000"),
      createDecimalValueString("0"),
      createDecimalValueString("4000"),
      createDecimalValueString("116000"),
      createDecimalValueString("0"),
      true,
    ]);

    expectTimePoint(projection.timePoints[2]!, [
      //Dont compare date, it should be the current date
      null,
      createDecimalValueString("120000"),
      createDecimalValueString("16000"),
      createDecimalValueString("0"),
      createDecimalValueString("4000"),
      createDecimalValueString("120000"),
      createDecimalValueString("0"),
      true,
    ]);
  });
});
