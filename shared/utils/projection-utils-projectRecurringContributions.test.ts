import { projectRecurringContributions } from "./projection-utils";
import { describe, it, expect } from "vitest";
import { Contributor, ContributorSchedule } from "@shared/schema/projections";
import { createDecimalValueString } from "@shared/schema/decimal-value";
import { createRRulePattern } from "./scheduling";
import { addYears } from "date-fns";

describe("projectRecurringContributions", () => {
  it("should return the correct contributions for a monthly contribution of 10 for 12 months", () => {
    const schedule: ContributorSchedule = {
      patternConfig: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"),
      value: createDecimalValueString("10.00"),
      startDate: new Date(),
      endDate: addYears(new Date(), 1),
    };

    const result = projectRecurringContributions(
      schedule,
      new Date(),
      new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    );

    let totalContributions = 0;

    for (const contribution of result) {
      totalContributions += Number(contribution.amount);
    }

    expect(totalContributions).toBe(120);
  });
});
