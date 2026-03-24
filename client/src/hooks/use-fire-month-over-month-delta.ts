import { useMemo } from "react";
import { createDecimalValueString, DecimalValueString } from "@shared/schema";
import type { FireProjection } from "@shared/schema/projections";
import Decimal from "decimal.js";

/**
 * Future-intention config:
 * Controls how many historical non-projected intervals we look back for the FireNow delta badge.
 * Current product behavior is "vs last month", so this stays at 1 for now.
 * This is intentionally isolated in a hook so the lookback can become developer-configurable later.
 */
export const FIRE_NOW_DEFAULT_LOOKBACK_INTERVALS = 1;

/**
 * Compute interval-over-interval portfolio delta for FireNow status.
 *
 * Rules:
 * - Uses non-projected points only (as-of + backfill context), not horizon tail points.
 * - Uses configurable lookback interval count (default 1 = "vs last month").
 * - Returns null when insufficient non-projected points exist.
 */
export function useFireMonthOverMonthDelta(
  projection?: FireProjection,
  lookbackIntervals: number = FIRE_NOW_DEFAULT_LOOKBACK_INTERVALS
): DecimalValueString | null {
  return useMemo(() => {
    if (!projection) return null;
    const pts = projection.projectionResult.timePoints;
    if (!pts || pts.length < 2) return null;

    const nonProjectedPoints = pts.filter((point) => !point.projectedValue);
    const lookback = Math.max(1, Math.floor(lookbackIntervals));
    if (nonProjectedPoints.length < lookback + 1) return null;

    const currentAsOfPoint = nonProjectedPoints[nonProjectedPoints.length - 1];
    const previousPoint =
      nonProjectedPoints[nonProjectedPoints.length - 1 - lookback];

    if (!currentAsOfPoint || !previousPoint) return null;

    const delta =
      Decimal(currentAsOfPoint.value).toNumber() -
      Decimal(previousPoint.value).toNumber();

    return createDecimalValueString(delta.toString());
  }, [projection, lookbackIntervals]);
}
