import { describe, it, expect } from "vitest";
import { getAnnualScheduledIncomeForContributor } from "./projection-withdrawal";
import { Contributor } from "@shared/schema/projections";
import { createDecimalValueString } from "@shared/schema/decimal-value";
import { createRRulePattern } from "./scheduling";
import { addYears } from "date-fns";
import { defineStatePensionDetailsUK } from "./projection-utils";

describe("getAnnualScheduledIncomeForContributor", () => {
  it("should return the correct State Pension contributions for a monthly contribution of 10 for 12 months", () => {
    // const contributor: Contributor = {
    //   name: "Test Contributor",
    //   accountType: "PENSION",
    //   type: "state_pension",
    //   currentValue: createDecimalValueString("0"),
    //   schedules: [
    //     {
    //       patternConfig: createRRulePattern(
    //         "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
    //       ),
    //       value: createDecimalValueString("1000.00"),
    //       startDate: startDate,
    //       endDate: null,
    //     },
    //   ],
    // };

    const dateOfBirth = new Date("1979-05-15");

    const { startDate: pensionStartDate, age: pensionAge } =
      defineStatePensionDetailsUK(dateOfBirth);

    const contributor: Contributor = {
      id: crypto.randomUUID(),
      name: "State Pension",
      type: "state_pension",
      currentValue: createDecimalValueString("0"),
      accountType: "PENSION",
      expectedGrowthRate: 0,
      valueReleases: [
        {
          value: pensionAge.toString(),
          valueType: "age",
        },
      ],
      schedules: [
        {
          patternConfig: {
            type: "rrule",
            expression: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
            ).expression,
          },
          startDate: pensionStartDate,
          endDate: null,
          value: createDecimalValueString("1000"),
        },
      ],
      includeValue: true,
      includeContributions: true,
    };

    const result = getAnnualScheduledIncomeForContributor(contributor);

    console.log("result", result);

    expect(result).toBe(createDecimalValueString("12000"));
  });
});
