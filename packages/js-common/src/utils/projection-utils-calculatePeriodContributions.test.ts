import { calculatePeriodContributions } from "./projection-utils";
import { describe, it, expect } from "vitest";
import { Contributor } from "../schema/projections";
import { createDecimalValueString } from "../schema/decimal-value";
import { createRRulePattern } from "./scheduling";
import { addYears } from "date-fns";
import { defineStatePensionDetailsUK } from "./projection-utils";

describe("calculatePeriodContributions", () => {
  it("should return the correct LISA contributions for a monthly contribution of 10 for 12 months", () => {
    const contributor: Contributor = {
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
          value: createDecimalValueString("10.00"),
          startDate: new Date(),
          endDate: addYears(new Date(), 1),
        },
      ],
      includeValue: true,
      includeContributions: true,
    };

    const result = calculatePeriodContributions(
      contributor,
      new Date(),
      addYears(new Date(), 1)
    );
    expect(result.contributions).toBe(120);
  });

  it.only("should return the correct State Pension contributions for a monthly contribution of 10 for 12 months", () => {
    const { startDate: pensionStartDate, age: pensionAge } =
      defineStatePensionDetailsUK(new Date("1979-05-15"));

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

    const startDate = pensionStartDate;
    const endDate = addYears(startDate, 1);

    console.log("startDate", startDate);
    console.log("endDate", endDate);

    const result = calculatePeriodContributions(
      contributor,
      startDate,
      endDate
    );
    console.log("result", result);
    expect(result.contributions).toBe(12000);
  });
});
