import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  modifiedDietzReturn,
  moneyWeightedIrrSolveAnnual,
} from "./portfolio-returns-mwr";

describe("modifiedDietzReturn", () => {
  it("matches hand-calculated GIPS day-weighting for one inflow", () => {
    const periodStart = new Date(Date.UTC(2024, 0, 1));
    const periodEnd = new Date(Date.UTC(2024, 0, 31));
    const bmv = new Decimal(100);
    const emv = new Decimal(105);
    const f = new Decimal(10);
    const r = modifiedDietzReturn({
      periodStart,
      periodEnd,
      beginningValue: bmv,
      endingValue: emv,
      cashFlows: [{ asOf: new Date(Date.UTC(2024, 0, 16)), amount: f }],
    });
    expect(r).not.toBeNull();
    const C = 31;
    const t = 15;
    const w = new Decimal(C - t).div(C);
    const num = emv.sub(bmv).sub(f);
    const den = bmv.add(w.mul(f));
    expect(r?.toFixed(8)).toBe(num.div(den).toFixed(8));
  });
});

describe("moneyWeightedIrrSolveAnnual", () => {
  it("solves a simple one-year investment (IRR ≈ 10% annual)", () => {
    const r = moneyWeightedIrrSolveAnnual({
      points: [
        { tYears: new Decimal(0), amount: new Decimal(-100) },
        { tYears: new Decimal(1), amount: new Decimal(110) },
      ],
    });
    expect(r).not.toBeNull();
    expect(r?.minus(0.1).abs().lt(1e-8)).toBe(true);
  });
});
