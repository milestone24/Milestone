import { useMemo } from "react";
import { differenceInMonths } from "date-fns";
import type { FireProjection } from "@shared/schema/projections";
import { findForwardStartIndex } from "@shared/utils/projection-model-path";

/** Default lookback for “retire sooner vs N months ago” on baseline projection (calendar intervals). */
export const FIRE_RETIREMENT_LOOKBACK_INTERVALS = 3;

/**
 * Months of retirement timing improvement vs lookback: positive = can retire sooner now
 * (earlier `projectedReachDate` at as-of than at the lookback slot). Uses **baseline** projection only.
 */
export function useFireRetirementMonthsSoonerVsLookback(
  baselineProjection: FireProjection | undefined,
  lookbackIntervals: number = FIRE_RETIREMENT_LOOKBACK_INTERVALS,
): number | null {
  return useMemo(() => {
    if (!baselineProjection) return null;
    const pts = baselineProjection.projectionResult.timePoints;
    if (pts.length === 0) return null;

    const startDate = new Date(
      baselineProjection.projectionResult.config.startDate,
    );
    const asOfIdx = findForwardStartIndex(pts, startDate);
    const lookback = Math.max(1, Math.floor(lookbackIntervals));
    const thenIdx = asOfIdx - lookback;
    if (thenIdx < 0) return null;

    const reachNow = pts[asOfIdx]?.projectedReachDate;
    const reachThen = pts[thenIdx]?.projectedReachDate;
    if (!reachNow || !reachThen) return null;

    return differenceInMonths(reachThen, reachNow);
  }, [baselineProjection, lookbackIntervals]);
}
