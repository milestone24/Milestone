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

/*
 * Educational / temporary: documents how "external flows" sit between TWR sub-periods.
 * Remove or trim once this is captured in product docs.
 *
 * Flow (for TWR): a net external movement of cash into or out of the measured portfolio
 * (e.g. bank deposit, withdrawal). Not: a trade that only swaps stock for cash already inside.
 *
 * Sub-period: an interval where the only effect on return is market movement — no flow inside.
 * When an external flow happens, it splits the timeline: the previous sub-period ends at the MV
 * immediately before the flow; the next starts at the MV immediately after the flow
 * (convention for same-day timing is a product choice).
 *
 *  t0                    t1 (flow)                 t2 (end)
 *  |-- sub-period 1 ----|--|-- sub-period 2 -----|
 *  V0              V1-  F  V1+                 V2
 *                    ^
 *            external +10,000 GBP
 *
 * - Sub-period 1: startValue = V0 (100,000), endValue = V1- (110,000).
 * - Flow +10,000 -> V1+ = 120,000.
 * - Sub-period 2: startValue = V1+ (120,000), endValue = V2 (128,000).
 *
 * The TWR helpers do not build the split from raw data; callers supply subPeriods aligned
 * to flows. This test only shows the numbers once that split exists.
 */
describe("TWR: example of timeline split at one external flow (educational)", () => {
  it("geometrically links two sub-period returns around one contribution", () => {
    const v0 = new Decimal(100_000);
    const v1BeforeFlow = new Decimal(110_000);
    const contribution = new Decimal(10_000);
    const v1AfterFlow = v1BeforeFlow.add(contribution);
    const v2 = new Decimal(128_000);

    const r = timeWeightedReturnFromSubPeriods({
      subPeriods: [
        { startValue: v0, endValue: v1BeforeFlow },
        { startValue: v1AfterFlow, endValue: v2 },
      ],
    });

    const r1 = v1BeforeFlow.div(v0).sub(1);
    const r2 = v2.div(v1AfterFlow).sub(1);
    const want = new Decimal(1).add(r1).mul(new Decimal(1).add(r2)).sub(1);

    expect(r?.equals(want)).toBe(true);
    expect(r1.equals(new Decimal("0.1"))).toBe(true);
    expect(v1AfterFlow.equals(new Decimal(120_000))).toBe(true);
  });
});
