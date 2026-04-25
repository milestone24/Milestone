import { z } from "zod";
import Decimal from "decimal.js";
import { decimalValueSchema } from "@server/db/schema/utils";

const ONE = new Decimal(1);

/**
 * Market value or flow amount: DB-branded string, plain string, number, or {@link Decimal}
 * (for tests and in-memory composition).
 */
export const portfolioReturnsTwrValueSchema = z
  .union([z.instanceof(Decimal), decimalValueSchema, z.string(), z.number()])
  .transform((v) => (v instanceof Decimal ? v : new Decimal(String(v))));

/**
 * A single TWR sub-period: market value at the **start** and **end** of an interval
 * with **no** external cash flows **inside** the interval. Callers are responsible
 * for splitting the full path at flow dates and supplying aligned MVs.
 */
export const portfolioReturnsTwrSubPeriodSchema = z.object({
  startValue: portfolioReturnsTwrValueSchema,
  endValue: portfolioReturnsTwrValueSchema,
});

export type PortfolioReturnsTwrSubPeriod = z.infer<
  typeof portfolioReturnsTwrSubPeriodSchema
>;

/**
 * Dated external cash flow (e.g. contribution positive, withdrawal negative) for
 * composition; path-splitting to sub-periods is a separate concern.
 */
export const portfolioReturnsTwrExternalFlowSchema = z.object({
  asOf: z.coerce.date(),
  amount: portfolioReturnsTwrValueSchema,
});

export type PortfolioReturnsTwrExternalFlow = z.infer<
  typeof portfolioReturnsTwrExternalFlowSchema
>;

const portfolioReturnsTwrSubPeriodArraySchema = z.array(
  portfolioReturnsTwrSubPeriodSchema
);

export const portfolioReturnsTwrFromSubPeriodsInputSchema = z.object({
  subPeriods: portfolioReturnsTwrSubPeriodArraySchema,
});

export type PortfolioReturnsTwrFromSubPeriodsInput = z.infer<
  typeof portfolioReturnsTwrFromSubPeriodsInputSchema
>;

/**
 * One sub-period TWR return: (end / start) - 1.
 * @returns `null` if `startValue` is zero (undefined return) or not finite.
 */
export function twrSubPeriodReturn(
  startValue: Decimal,
  endValue: Decimal
): Decimal | null {
  if (startValue.isZero() || !startValue.isFinite() || !endValue.isFinite()) {
    return null;
  }
  return endValue.div(startValue).sub(ONE);
}

/**
 * Geometrically link sub-period returns: Π(1 + r_i) - 1.
 * Empty input returns `null` (define policy at the call site if you need 0).
 */
export function twrGeometricallyLinkSubPeriodReturns(
  subPeriodReturns: readonly Decimal[]
): Decimal | null {
  if (subPeriodReturns.length === 0) {
    return null;
  }
  let factor = new Decimal(1);
  for (const r of subPeriodReturns) {
    if (!r.isFinite()) {
      return null;
    }
    const term = ONE.plus(r);
    if (term.lte(0)) {
      return null;
    }
    factor = factor.mul(term);
  }
  return factor.sub(ONE);
}

/**
 * Full-window TWR from precomputed, flow-free sub-periods (start/end market values only).
 * Each sub-period must exclude internal cash flows; order must be chronological.
 */
export function timeWeightedReturnFromSubPeriods(
  input: PortfolioReturnsTwrFromSubPeriodsInput
): Decimal | null {
  const { subPeriods } = portfolioReturnsTwrFromSubPeriodsInputSchema.parse(
    input
  );
  const returns: Decimal[] = [];
  for (const p of subPeriods) {
    const r = twrSubPeriodReturn(p.startValue, p.endValue);
    if (r === null) {
      return null;
    }
    returns.push(r);
  }
  return twrGeometricallyLinkSubPeriodReturns(returns);
}
