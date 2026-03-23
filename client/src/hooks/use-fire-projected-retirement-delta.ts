import { useMemo } from "react";
import { createDecimalValueString, DecimalValueString } from "@shared/schema";
import type { FireProjection } from "@shared/schema/projections";
import Decimal from "decimal.js";

/**
 * Lookback interval count for the projected-retirement-value delta badge on the hero card.
 * 1 = "vs last month".
 */
export const FIRE_HERO_RETIREMENT_DELTA_LOOKBACK = 1;

/**
 * Returns the change in `projectedPortfolioAtRetirement` between the current as-of point
 * and the point `lookbackIntervals` non-projected intervals ago.
 *
 * This is the delta of how much the projected portfolio value AT retirement has shifted
 * since last month — distinct from the current portfolio's month-over-month movement.
 */
export function useFireProjectedRetirementDelta(
  projection?: FireProjection,
  lookbackIntervals: number = FIRE_HERO_RETIREMENT_DELTA_LOOKBACK,
): DecimalValueString | null {
  return useMemo(() => {
    if (!projection) return null;
    const pts = projection.projectionResult.timePoints;
    if (!pts || pts.length < 2) return null;

    const nonProjected = pts.filter((p) => !p.projectedValue);
    const lookback = Math.max(1, Math.floor(lookbackIntervals));
    if (nonProjected.length < lookback + 1) return null;

    const current = nonProjected[nonProjected.length - 1];
    const previous = nonProjected[nonProjected.length - 1 - lookback];

    if (
      !current?.projectedPortfolioAtRetirement ||
      !previous?.projectedPortfolioAtRetirement
    ) {
      return null;
    }

    const delta =
      Decimal(current.projectedPortfolioAtRetirement).toNumber() -
      Decimal(previous.projectedPortfolioAtRetirement).toNumber();

    return createDecimalValueString(delta.toString());
  }, [projection, lookbackIntervals]);
}
