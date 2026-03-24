import { differenceInMonths } from "date-fns";
import type { FireProjection } from "@shared/schema/projections";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Months by which the active (preview) projection reaches FIRE sooner (+) or later (−)
 * than the baseline projection. Uses calendar months between projected retirement dates
 * when both exist; otherwise falls back to fractional years remaining.
 *
 * When a year-start baseline is added server-side, wire YTD separately — this helper is
 * only for preview vs saved-plan (`baselineProjection` vs slider-adjusted preview).
 */
export function getPreviewRetirementMonthsDelta(
  baseline: FireProjection | undefined,
  active: FireProjection | undefined,
): number | null {
  if (!baseline || !active) return null;

  const bDate = baseline.projectedRetirementDate;
  const aDate = active.projectedRetirementDate;

  if (bDate != null && aDate != null) {
    return differenceInMonths(toDate(bDate), toDate(aDate));
  }

  const bY = baseline.yearsRemainingToFireTarget;
  const aY = active.yearsRemainingToFireTarget;
  if (Number.isFinite(bY) && Number.isFinite(aY)) {
    return Math.round((bY - aY) * 12);
  }

  return null;
}
