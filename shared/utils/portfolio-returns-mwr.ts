import { z } from "zod";
import Decimal from "decimal.js";
import { decimalValueSchema } from "@server/db/schema/utils";

const ONE = new Decimal(1);
const dayMs = 86_400_000;

/**
 * Non-branded number-like values as {@link Decimal} (e.g. year fractions for IRR, not DB money).
 */
const decimalLikeSchema = z
  .union([z.string(), z.number(), z.instanceof(Decimal)])
  .transform((v) => (v instanceof Decimal ? v : new Decimal(String(v))));

/**
 * Market value, cash amount, or year fraction: branded DB string, plain string, number, or
 * {@link Decimal} (tests and composition).
 */
export const portfolioReturnsMwrValueSchema = z
  .union([z.instanceof(Decimal), decimalValueSchema, z.string(), z.number()])
  .transform((v) => (v instanceof Decimal ? v : new Decimal(String(v))));

/**
 * Cash flow within a period for Modified Dietz: amount positive = external inflow
 * to the portfolio, negative = outflow, at `asOf` within `[periodStart, periodEnd]`.
 */
export const portfolioReturnsMwrCashFlowSchema = z.object({
  asOf: z.coerce.date(),
  amount: portfolioReturnsMwrValueSchema,
});

export type PortfolioReturnsMwrCashFlow = z.infer<
  typeof portfolioReturnsMwrCashFlowSchema
>;

/**
 * GIPS-style Modified Dietz inputs. Weights are day-based from `periodStart` to `periodEnd`
 * (inclusive span of calendar days, minimum one day to avoid a zero denominator).
 */
export const portfolioReturnsMwrModifiedDietzInputSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  beginningValue: portfolioReturnsMwrValueSchema,
  endingValue: portfolioReturnsMwrValueSchema,
  cashFlows: z.array(portfolioReturnsMwrCashFlowSchema),
});

export type PortfolioReturnsMwrModifiedDietzInput = z.infer<
  typeof portfolioReturnsMwrModifiedDietzInputSchema
>;

function calendarDaysInclusive(start: Date, end: Date): number {
  const s = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const e = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  );
  const diff = Math.floor((e - s) / dayMs) + 1;
  return Math.max(1, diff);
}

/**
 * Day offset of `d` from `start` in whole calendar days (start day = 0), clamped to `[0, C-1]`
 * where C is the inclusive day count of the full period.
 */
function daysFromPeriodStart(periodStart: Date, d: Date, fullPeriodDays: number) {
  const s = Date.UTC(
    periodStart.getUTCFullYear(),
    periodStart.getUTCMonth(),
    periodStart.getUTCDate()
  );
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const raw = Math.floor((t - s) / dayMs);
  return Math.max(0, Math.min(Math.max(1, fullPeriodDays) - 1, raw));
}

/**
 * Modified Dietz return over `[periodStart, periodEnd]`.
 *
 * R = (EMV - BMV - ΣFᵢ) / (BMV + Σ wᵢ Fᵢ) where
 * wᵢ = (C - tᵢ) / C, C = total calendar days in the period, tᵢ = calendar days
 * from period start to the flow (GIPS day-weighting).
 *
 * @returns `null` if the denominator is zero, inputs invalid, or result non-finite.
 */
export function modifiedDietzReturn(
  input: PortfolioReturnsMwrModifiedDietzInput
): Decimal | null {
  const parsed = portfolioReturnsMwrModifiedDietzInputSchema.parse(input);
  if (parsed.periodEnd.getTime() < parsed.periodStart.getTime()) {
    return null;
  }

  const bmv = parsed.beginningValue;
  const emv = parsed.endingValue;
  if (!bmv.isFinite() || !emv.isFinite()) {
    return null;
  }

  const C = calendarDaysInclusive(parsed.periodStart, parsed.periodEnd);
  let sumF = new Decimal(0);
  let weighted = new Decimal(0);

  for (const cf of parsed.cashFlows) {
    if (!cf.amount.isFinite()) {
      return null;
    }
    sumF = sumF.add(cf.amount);
    const t = daysFromPeriodStart(parsed.periodStart, cf.asOf, C);
    const w = new Decimal(C - t).div(C);
    weighted = weighted.add(w.mul(cf.amount));
  }

  const numerator = emv.sub(bmv).sub(sumF);
  const denominator = bmv.add(weighted);
  if (denominator.isZero() || !denominator.isFinite() || !numerator.isFinite()) {
    return null;
  }
  return numerator.div(denominator);
}

const portfolioReturnsMwrIrrPointSchema = z.object({
  /** Time in **years** from a common base (e.g. flow date as year fraction). */
  tYears: decimalLikeSchema,
  /**
   * Cash flow: negative = money *into* the portfolio, positive = *out* to investor, or
   * follow a single sign convention; callers must be consistent. XNPV uses amounts as signed.
   */
  amount: portfolioReturnsMwrValueSchema,
});

export const portfolioReturnsMwrIrrInputSchema = z.object({
  points: z.array(portfolioReturnsMwrIrrPointSchema).min(1),
});

export type PortfolioReturnsMwrIrrPoint = z.infer<
  typeof portfolioReturnsMwrIrrPointSchema
>;
export type PortfolioReturnsMwrIrrInput = z.infer<
  typeof portfolioReturnsMwrIrrInputSchema
>;

function xnpv(rate: Decimal, points: { tYears: Decimal; amount: Decimal }[]) {
  let sum = new Decimal(0);
  for (const p of points) {
    if (!p.amount.isFinite() || !p.tYears.isFinite()) {
      return null;
    }
    const disc = ONE.plus(rate).pow(p.tYears.neg());
    if (!disc.isFinite() || disc.isZero()) {
      return null;
    }
    sum = sum.add(p.amount.mul(disc));
  }
  return sum;
}

const IRR_LOW = new Decimal(-0.9999);
const IRR_HIGH = new Decimal(10);
const ITER = 60;

function npvAt(points: { tYears: Decimal; amount: Decimal }[], rate: Decimal) {
  return xnpv(rate, points);
}

/**
 * Annual discount rate r such that Σ amountᵢ (1 + r)^(-tYears_i) ≈ 0 (XNPV), by bisection.
 * `tYears` and `r` are in the same time basis (e.g. years from a common base).
 * Callers must use a consistent cash-flow sign convention. Returns `null` if the search
 * bracket [IRR_LOW, IRR_HIGH] does not straddle a root.
 */
export function moneyWeightedIrrSolveAnnual(
  input: PortfolioReturnsMwrIrrInput
): Decimal | null {
  const { points } = portfolioReturnsMwrIrrInputSchema.parse(input);
  const fLo = npvAt(points, IRR_LOW);
  const fHi = npvAt(points, IRR_HIGH);
  if (fLo === null || fHi === null) {
    return null;
  }
  if (fLo.isZero() || fHi.isZero()) {
    return fLo.isZero() ? IRR_LOW : IRR_HIGH;
  }
  if (fLo.mul(fHi).gte(0)) {
    return null;
  }
  let lo = IRR_LOW;
  let hi = IRR_HIGH;
  let mid = lo.add(hi).div(2);
  for (let i = 0; i < ITER; i++) {
    mid = lo.add(hi).div(2);
    const fMid = npvAt(points, mid);
    if (fMid === null) {
      return null;
    }
    if (fMid.isZero() || lo.sub(hi).abs().lt(new Decimal(1e-20))) {
      return mid;
    }
    const fLoB = npvAt(points, lo);
    if (fLoB === null) {
      return null;
    }
    if (fLoB.mul(fMid).lt(0)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return mid;
}
