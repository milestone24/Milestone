import { calculatePeriodContributions } from "./projection-utils";
import { describe, it, expect } from "vitest";
import { Contributor } from "@shared/schema/projections";
import { createDecimalValueString } from "@shared/schema/utils";
import { createRRulePattern } from "./scheduling";
import { addYears } from "date-fns";

describe("calculatePeriodContributions", () => {
  it("should return the correct contributions for a monthly contribution of 10 for 12 months", () => {
    const contributor = {
      name: "Test Contributor",
      accountType: "LISA",
      type: "asset",
      currentValue: createDecimalValueString("100000"),
      schedules: [
        {
          patternConfig: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"),
          value: createDecimalValueString("10.00"),
          startDate: new Date(),
          endDate: addYears(new Date(), 1),
        },
      ],
    };

    const result = calculatePeriodContributions(contributor, new Date(), addYears(new Date(), 1));
    console.log("result", result);
    expect(result.contributions).toBe(120);
  });
});