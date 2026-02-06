import { generateSimpleProjection } from "./projection-simple";
import { describe, it, expect } from "vitest";
import { createRRulePattern } from "./scheduling";
import { createDecimalValueString } from "@shared/schema";
import { Contributor } from "@shared/schema/projections";

describe("generateSimpleProjection and expect contributions to be correct", () => {
  it("with one recurring contribution on 1st of each month for 18 months", () => {
    const projectionStartDate = new Date("2025-01-10");
    const projectionEndDate = new Date("2026-07-10");
    const constributionOneStartDate = new Date("2025-01-30");
    const constributionOneEndDate = new Date("2026-01-30");

    const contributor: Contributor = {
      name: "Test Asset",
      accountType: "GIA",
      type: "asset",
      currentValue: createDecimalValueString("100000"),
      schedules: [
        {
          value: createDecimalValueString("1000"),
          patternConfig: {
            type: "rrule",
            expression: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
              //"FREQ=MONTHLY;INTERVAL=1;COUNT=10;BYMONTHDAY=1"
            ).expression,
          },
          startDate: constributionOneStartDate,
          endDate: constributionOneEndDate,
        },
      ],
      valueReleases: [],
      bonusValues: [],
    };

    const projection = generateSimpleProjection({
      config: {
        mode: "simple",
        growthRate: 7.0,
        growthModel: "linear",
        //1 yesr ago
        startDate: projectionStartDate,
        endDate: projectionEndDate,
        interval: "yearly",
        modifiers: [],
        useContributorSpecificGrowthRates: false,
        usePortfolioRecurringContributions: true,
      },
      currentValue: createDecimalValueString("100000"),
      scheduledContributions: contributor.schedules,
      contributor,
    });

    console.log("projection", projection);

    expect(projection).toBeDefined();
    /**
     * Expected time points:
     * projectionStartDate.
     * projectionStartDate + 1 year because the projection interval is yearly.
     * projectionEndDate
     */
    expect(projection.timePoints.length).toBe(3);
    expect(projection.timePoints[0]?.date).toStrictEqual(projectionStartDate);
    expect(projection.timePoints[0]?.contributions).toBe("0");
    expect(projection.timePoints[1]?.date).toStrictEqual(
      new Date(
        projectionStartDate.setFullYear(projectionStartDate.getFullYear() + 1)
      )
    );
    //expect(projection.timePoints[1]?.value).toBe(100000);
    //Expect a conritbution once a month of 1000 for the first year
    expect(projection.timePoints[1]?.contributions).toBe("12000");
    expect(projection.timePoints[2]?.date).toStrictEqual(projectionEndDate);
    //Expect a contribution once a month of 1000 for 6 months of the second year (+ 6000)
    expect(projection.timePoints[2]?.contributions).toBe("18000");
  });

  //TODO test more variations of the projection and contributions
  //List variations to be tested
});
