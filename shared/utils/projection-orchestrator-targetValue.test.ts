import { describe, it, expect } from "vitest";
import { addYears, subMonths, startOfMonth, differenceInMonths } from "date-fns";
import { orchestrateProjection } from "./projection-orchestrator";
import { findForwardStartIndex } from "./projection-model-path";
import { createDecimalValueString } from "@shared/schema/utils";
import {
  Contributor,
  ProjectionConfigWithDateRange,
} from "@shared/schema/projections";

const asOf = startOfMonth(new Date());
const threeMonthsAgo = startOfMonth(subMonths(asOf, 3));
const twoMonthsAgo = startOfMonth(subMonths(asOf, 2));
const oneMonthAgo = startOfMonth(subMonths(asOf, 1));

function makeContributor(currentValue: string, history: { date: Date; value: string }[]): Contributor {
  return {
    id: crypto.randomUUID(),
    accountType: "ISA",
    currentValue: createDecimalValueString(currentValue),
    name: "Test ISA",
    type: "asset",
    schedules: [
      {
        value: createDecimalValueString("1000"),
        patternConfig: { type: "rrule", expression: "FREQ=MONTHLY;INTERVAL=1" },
        startDate: asOf,
        endDate: null,
      },
    ],
    includeValue: true,
    includeContributions: true,
    valueHistory: history.map((h) => ({
      slotDate: h.date,
      value: createDecimalValueString(h.value),
      sourceValueDate: h.date,
      sourceType: "exact" as const,
    })),
  };
}

describe("orchestrateProjection with targetValue — below-window target (behind schedule)", () => {
  // Target is 4x current value: model path never crosses within window,
  // so non-projected points rely entirely on the counterfactual calculation.
  const config: ProjectionConfigWithDateRange = {
    mode: "simple",
    growthRate: 7,
    growthModel: "linear",
    interval: "monthly",
    seriesAlignment: "calendar",
    backfillIntervals: 3,
    modifiers: [],
    usePortfolioRecurringContributions: true,
    useContributorSpecificGrowthRates: false,
    startDate: asOf,
    endDate: addYears(asOf, 30),
  };

  const contributor = makeContributor("500000", [
    { date: threeMonthsAgo, value: "480000" },
    { date: twoMonthsAgo, value: "490000" },
    { date: oneMonthAgo, value: "495000" },
  ]);

  const targetValue = createDecimalValueString("2000000");

  it("should populate projectedReachDate on all non-projected points", async () => {
    const result = await orchestrateProjection({ contributors: [contributor], config, targetValue });
    const nonProjected = result.timePoints.filter((p) => !p.projectedValue);
    expect(nonProjected.length).toBeGreaterThan(0);
    for (const p of nonProjected) {
      expect(p.projectedReachDate).not.toBeNull();
    }
  });

  it("should give the as-of point an earlier projectedReachDate than the lookback point", async () => {
    const result = await orchestrateProjection({ contributors: [contributor], config, targetValue });
    const pts = result.timePoints;
    const asOfIdx = findForwardStartIndex(pts, asOf);
    const thenIdx = asOfIdx - 3;
    expect(thenIdx).toBeGreaterThanOrEqual(0);
    const reachNow = pts[asOfIdx]?.projectedReachDate;
    const reachThen = pts[thenIdx]?.projectedReachDate;
    expect(reachNow).not.toBeNull();
    expect(reachThen).not.toBeNull();
    expect(differenceInMonths(reachThen!, reachNow!)).toBeGreaterThan(0);
  });
});

describe("orchestrateProjection with targetValue — within-window target (on track)", () => {
  // Target IS crossed within the window (portfolio reaches target well before endDate).
  // The non-projected points must still get independent counterfactual reach dates,
  // NOT the same shared date that the backward scan propagates.
  const config: ProjectionConfigWithDateRange = {
    mode: "simple",
    growthRate: 7,
    growthModel: "linear",
    interval: "monthly",
    seriesAlignment: "calendar",
    backfillIntervals: 3,
    modifiers: [],
    usePortfolioRecurringContributions: true,
    useContributorSpecificGrowthRates: false,
    startDate: asOf,
    endDate: addYears(asOf, 30),
  };

  // Target is just 20% above current value: model path crosses within the window.
  const contributor = makeContributor("500000", [
    { date: threeMonthsAgo, value: "450000" },
    { date: twoMonthsAgo, value: "470000" },
    { date: oneMonthAgo, value: "490000" },
  ]);

  const targetValue = createDecimalValueString("600000");

  it("should give non-projected points distinct projectedReachDates reflecting their portfolio value", async () => {
    const result = await orchestrateProjection({ contributors: [contributor], config, targetValue });
    const pts = result.timePoints;
    const asOfIdx = findForwardStartIndex(pts, asOf);
    const thenIdx = asOfIdx - 3;
    expect(thenIdx).toBeGreaterThanOrEqual(0);
    const reachNow = pts[asOfIdx]?.projectedReachDate;
    const reachThen = pts[thenIdx]?.projectedReachDate;
    expect(reachNow).not.toBeNull();
    expect(reachThen).not.toBeNull();
    // reachThen must be later than reachNow (lower starting value → later retirement)
    expect(differenceInMonths(reachThen!, reachNow!)).toBeGreaterThan(0);
  });
});
