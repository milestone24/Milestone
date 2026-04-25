import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  timeWeightedReturnFromSubPeriods,
  twrGeometricallyLinkSubPeriodReturns,
  twrSubPeriodReturn,
} from "./portfolio-returns-twr";

describe("twrSubPeriodReturn", () => {
  it("returns (end / start) - 1 for a gain", () => {
    const r = twrSubPeriodReturn(new Decimal(100), new Decimal(110));
    expect(r?.equals(new Decimal("0.1"))).toBe(true);
  });

  it("returns null when start is zero", () => {
    expect(twrSubPeriodReturn(new Decimal(0), new Decimal(100))).toBeNull();
  });
});

describe("twrGeometricallyLinkSubPeriodReturns", () => {
  it("returns null for an empty list", () => {
    expect(twrGeometricallyLinkSubPeriodReturns([])).toBeNull();
  });

  it("is the single return for one sub-period", () => {
    const r = twrGeometricallyLinkSubPeriodReturns([new Decimal(0.01)]);
    expect(r?.equals(new Decimal("0.01"))).toBe(true);
  });

  it("links 1% and 2% to (1.01 * 1.02) - 1", () => {
    const r = twrGeometricallyLinkSubPeriodReturns([
      new Decimal(0.01),
      new Decimal(0.02),
    ]);
    const want = new Decimal(1.01)
      .mul(new Decimal(1.02))
      .sub(1);
    expect(r?.equals(want)).toBe(true);
  });
});

describe("timeWeightedReturnFromSubPeriods", () => {
  it("links two MV pairs", () => {
    const r = timeWeightedReturnFromSubPeriods({
      subPeriods: [
        { startValue: new Decimal(100), endValue: new Decimal(101) },
        { startValue: new Decimal(101), endValue: new Decimal(102.5) },
      ],
    });
    const sub0 = new Decimal(101).div(100).sub(1);
    const sub1 = new Decimal(102.5).div(101).sub(1);
    const want = new Decimal(1)
      .plus(sub0)
      .mul(new Decimal(1).plus(sub1))
      .sub(1);
    expect(r?.toFixed(8)).toBe(want.toFixed(8));
  });
});
