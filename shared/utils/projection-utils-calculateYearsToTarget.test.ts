import { describe, it } from "vitest";
import { createDecimalValueString } from "@shared/schema/utils";
import { Contributor, ContributorSchedule } from "@shared/schema/projections";
import { createRRulePattern } from "./scheduling";
import { calculateYearsToTarget } from "./projection-utils";
import { createModifierChain } from "./projection-modifiers";


describe.only("calculateYearsToTarget", () => {
  it("should return the correct number of years to target", () => {
    const presentValue = createDecimalValueString("10000");

    const c: Contributor[] = [
      // {
      //   id: "88652df0-34f3-4638-9148-30edfb2e5b09",
      //   referenceId: "03091e4b-9422-45b2-8ebc-af0c4b094afa",
      //   accountType: "ISA",
      //   name: "account--DUO8A66",
      //   type: "asset",
      //   currentValue: createDecimalValueString("7152.93"),
      //   schedules: [],
      //   valueReleases: [
      //     {
      //       value: "60",
      //       valueType: "age",
      //       penalties: [
      //         {
      //           rule: {
      //             comparator: "lt",
      //             value: "60"
      //           },
      //           penalty: {
      //             valueType: "percentage",
      //             value: createDecimalValueString("0.25")
      //           }
      //         }
      //       ],
      //     }
      //   ],
      //   bonusValues: [
      //     {
      //       name: "LISA",
      //       valueType: "percentage",
      //       value: createDecimalValueString("0.25"),
      //       annualLimit: createDecimalValueString("1000"),
      //       annualContributionLimit: createDecimalValueString("4000"),
      //       priority: 1
      //     }
      //   ],
      //   taxes: [],
      //   expectedGrowthRate: 7,
      //   includeValue: true,
      //   includeContributions: false
      // },
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
            value: createDecimalValueString("100.00"),
            patternConfig: {
              type: "rrule",
              expression: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1").expression,
            }
          }
        ],
        includeValue: true,
        includeContributions: true
      },
      // {
      //   id: "e8c953d5-6329-44c1-9c87-cb4a6381ad9c",
      //   name: "State Pension",
      //   type: "state_pension",
      //   currentValue: createDecimalValueString("0"),
      //   accountType: "PENSION",
      //   expectedGrowthRate: 0,
      //   valueReleases: [
      //     {
      //       value: createDecimalValueString("67"),
      //       valueType: "age"
      //     }
      //   ],
      //   schedules: [
      //     {
      //       patternConfig: {
      //         type: "rrule",
      //         expression: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1").expression,
      //       },
      //       startDate: new Date("2046-05-15T00:00:00.000Z"),
      //       endDate: null,
      //       value: createDecimalValueString("1000")
      //     }
      //   ],
      //   includeValue: true,
      //   includeContributions: true
      // }
    ]
    const scheduledContributions = c.filter((c) => c.includeContributions).map((c) => c.schedules).flat();

    console.log("scheduledContributions : ", scheduledContributions);

    const annualGrowthRate = 7;
    const targetValue = createDecimalValueString("1000000");
    const config = {
      startDate: new Date(),
      maxYears: 100,
    };

    const modifierChain = createModifierChain([]);

    const yearsToTarget = calculateYearsToTarget(presentValue, c, annualGrowthRate, targetValue, modifierChain, config);

    console.log("yearsToTarget : ", yearsToTarget);
  });
});