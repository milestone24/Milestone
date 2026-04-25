import Decimal from "decimal.js";
import { createDecimalValueString, type DecimalValueString } from "@shared/schema";
import {
  modifiedDietzReturn,
  type PortfolioReturnsMwrCashFlow,
} from "./portfolio-returns-mwr";
import { twrGeometricallyLinkSubPeriodReturns } from "./portfolio-returns-twr";

/**
 * Start of UTC calendar day for `d` (ms since epoch), for comparing flow dates to value EODs.
 */
function utcDayStart(d: Date): number {
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  );
}

/**
 * Sums `asset_transaction` cash flows (UTC calendar days) strictly after `earlierEod`’s day and on or before
 * `laterEod`’s day. Matches the convention: value points are EOD; external flows on day D are applied at the
 * start of D after the previous EOD.
 */
export function sumExternalFlowsForSegment(
  flows: { asOf: Date; amount: Decimal }[],
  earlierEod: Date,
  laterEod: Date
): Decimal {
  const t0 = utcDayStart(earlierEod);
  const t1 = utcDayStart(laterEod);
  return flows
    .filter((f) => {
      const tf = utcDayStart(f.asOf);
      return tf > t0 && tf <= t1;
    })
    .reduce((acc, f) => acc.add(f.amount), new Decimal(0));
}

export type PortfolioValuePoint = {
  valueDate: Date;
  value: Decimal | string;
};

/**
 * Chains segment returns: rᵢ = (Eᵢ − (Eᵢ₋₁ + Fᵢ)) is not used; we use
 * rᵢ = Eᵢ / (Eᵢ₋₁ + Fᵢ) − 1 with Fᵢ = external flow sum in the segment, then geometrically link.
 */
export function timeWeightedReturnLinkedFromValuePath(
  valuePoints: PortfolioValuePoint[],
  flows: { asOf: Date; amount: Decimal }[]
): Decimal | null {
  if (valuePoints.length < 2) {
    return null;
  }
  const sorted = [...valuePoints].sort(
    (a, b) => a.valueDate.getTime() - b.valueDate.getTime()
  );
  const returns: Decimal[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const ePrev = new Decimal(String(sorted[i - 1]!.value));
    const eCurr = new Decimal(String(sorted[i]!.value));
    const F = sumExternalFlowsForSegment(
      flows,
      sorted[i - 1]!.valueDate,
      sorted[i]!.valueDate
    );
    const denom = ePrev.add(F);
    if (denom.isZero() || !denom.isFinite() || !eCurr.isFinite()) {
      return null;
    }
    const r = eCurr.div(denom).sub(1);
    if (!r.isFinite()) {
      return null;
    }
    returns.push(r);
  }
  return twrGeometricallyLinkSubPeriodReturns(returns);
}

export type ComputePortfolioRangeReturnsInput = {
  valuePoints: PortfolioValuePoint[];
  cashFlows: PortfolioReturnsMwrCashFlow[];
  periodStart: Date;
  periodEnd: Date;
};

export type ComputePortfolioRangeReturnsResult = {
  beginningValue: DecimalValueString;
  endingValue: DecimalValueString;
  modifiedDietz: Decimal | null;
  timeWeightedReturn: Decimal | null;
};

/**
 * Portfolio-level Modified Dietz and TWR (linked daily segments) for an analysis window. Pure composition;
 * loads data in the service layer.
 * @returns `null` if there is no value history to anchor BMV/EMV.
 */
export function computePortfolioRangeReturns(
  input: ComputePortfolioRangeReturnsInput
): ComputePortfolioRangeReturnsResult | null {
  const { valuePoints, cashFlows, periodStart, periodEnd } = input;
  if (valuePoints.length < 1) {
    return null;
  }
  const sorted = [...valuePoints].sort(
    (a, b) => a.valueDate.getTime() - b.valueDate.getTime()
  );
  const b = new Decimal(String(sorted[0]!.value));
  const e = new Decimal(String(sorted[sorted.length - 1]!.value));
  const beginningValue = createDecimalValueString(b.toString());
  const endingValue = createDecimalValueString(e.toString());
  const flows = cashFlows.map((c) => ({
    asOf: c.asOf,
    amount: c.amount instanceof Decimal ? c.amount : new Decimal(String(c.amount)),
  }));
  const mdr = modifiedDietzReturn({
    periodStart,
    periodEnd,
    beginningValue: b,
    endingValue: e,
    cashFlows: flows,
  });
  const twr =
    sorted.length >= 2
      ? timeWeightedReturnLinkedFromValuePath(sorted, flows)
      : null;
  return {
    beginningValue,
    endingValue,
    modifiedDietz: mdr,
    timeWeightedReturn: twr,
  };
}

export function mapDecimalToNullableDecimalString(
  d: Decimal | null
): DecimalValueString | null {
  if (d === null || !d.isFinite()) {
    return null;
  }
  return createDecimalValueString(d.toString());
}
