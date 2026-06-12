import type {
  Contributor,
  GrowthModel,
  ProjectionTimePoint,
  SimpleProjectionConfigWithDateRange,
} from "../schema/projections";
import { createDecimalValueString, DecimalValueString } from "../schema";
import Decimal from "decimal.js";
import type { BonusAnnualUsage } from "./projection-bonus-calculator";
import type { ModifierChain } from "./projection-modifiers";
import { calculateYearsElapsed } from "./projection-modifiers";
import {
  applyModifiersToValue,
  calculatePeriodContributions,
  getEffectiveGrowthRate,
} from "./projection-utils";

// ============================================================================
// FORWARD START INDEX (as-of on calendar grid)
// ============================================================================

/** First index whose date is on or after projection `startDate` (matches simple projection anchor). */
export function findForwardStartIndex(
  points: ProjectionTimePoint[],
  startDate: Date,
): number {
  const t = startDate.getTime();
  const idx = points.findIndex((p) => p.date.getTime() >= t);
  return idx === -1 ? 0 : idx;
}

// ============================================================================
// ONE INTERVAL — compound (matches compound series semantics)
// ============================================================================

function stepIntervalCompound(
  startBalance: DecimalValueString,
  previousDate: Date,
  nextDate: Date,
  contributor: Contributor,
  config: SimpleProjectionConfigWithDateRange,
  modifierChain: ModifierChain,
  projectionStartDate: Date,
  annualBonusUsage: Map<string, BonusAnnualUsage>,
): { endValue: DecimalValueString; annualBonusUsage: Map<string, BonusAnnualUsage> } {
  const yearsInInterval = calculateYearsElapsed(previousDate, nextDate);
  const effectiveGrowthRate = getEffectiveGrowthRate(contributor, config);
  const growthFactor =
    effectiveGrowthRate === 0
      ? 1
      : Math.pow(1 + effectiveGrowthRate / 100, yearsInInterval);
  let projectedValue = Decimal(startBalance).mul(growthFactor);

  const periodResult = calculatePeriodContributions(
    contributor,
    previousDate,
    nextDate,
    modifierChain,
    createDecimalValueString(projectedValue.toString()),
    projectionStartDate,
    annualBonusUsage,
  );

  projectedValue = Decimal(projectedValue)
    .add(periodResult.contributions)
    .add(Decimal(periodResult.bonuses));

  const finalValue = applyModifiersToValue(
    createDecimalValueString(projectedValue.toString()),
    createDecimalValueString(projectedValue.toString()),
    projectionStartDate,
    nextDate,
    modifierChain,
  );

  return {
    endValue: finalValue,
    annualBonusUsage: periodResult.updatedAnnualUsage,
  };
}

// ============================================================================
// ONE INTERVAL — linear (period-local growth from interval start balance)
// ============================================================================

function stepIntervalLinear(
  startBalance: DecimalValueString,
  previousDate: Date,
  nextDate: Date,
  contributor: Contributor,
  config: SimpleProjectionConfigWithDateRange,
  modifierChain: ModifierChain,
  projectionStartDate: Date,
  annualBonusUsage: Map<string, BonusAnnualUsage>,
): { endValue: DecimalValueString; annualBonusUsage: Map<string, BonusAnnualUsage> } {
  const yearsInInterval = calculateYearsElapsed(previousDate, nextDate);
  const effectiveGrowthRate = getEffectiveGrowthRate(contributor, config);
  const growthValue =
    effectiveGrowthRate === 0
      ? Decimal(0)
      : Decimal(startBalance)
        .mul(Decimal(effectiveGrowthRate).div(100))
        .mul(yearsInInterval);

  const midForContributions = createDecimalValueString(
    Decimal(startBalance).add(growthValue).toString(),
  );

  const periodResult = calculatePeriodContributions(
    contributor,
    previousDate,
    nextDate,
    modifierChain,
    midForContributions,
    projectionStartDate,
    annualBonusUsage,
  );

  const projectedValue = Decimal(startBalance)
    .add(growthValue)
    .add(periodResult.contributions)
    .add(Decimal(periodResult.bonuses));

  const finalValue = applyModifiersToValue(
    createDecimalValueString(projectedValue.toString()),
    createDecimalValueString(projectedValue.toString()),
    projectionStartDate,
    nextDate,
    modifierChain,
  );

  return {
    endValue: finalValue,
    annualBonusUsage: periodResult.updatedAnnualUsage,
  };
}

function stepInterval(
  growthModel: GrowthModel,
  startBalance: DecimalValueString,
  previousDate: Date,
  nextDate: Date,
  contributor: Contributor,
  config: SimpleProjectionConfigWithDateRange,
  modifierChain: ModifierChain,
  projectionStartDate: Date,
  annualBonusUsage: Map<string, BonusAnnualUsage>,
): { endValue: DecimalValueString; annualBonusUsage: Map<string, BonusAnnualUsage> } {
  return growthModel === "linear"
    ? stepIntervalLinear(
      startBalance,
      previousDate,
      nextDate,
      contributor,
      config,
      modifierChain,
      projectionStartDate,
      annualBonusUsage,
    )
    : stepIntervalCompound(
      startBalance,
      previousDate,
      nextDate,
      contributor,
      config,
      modifierChain,
      projectionStartDate,
      annualBonusUsage,
    );
}

// ============================================================================
// PER-CONTRIBUTOR MODEL PATH
// ============================================================================

export type EnrichModelPathParams = {
  contributor: Contributor;
  config: SimpleProjectionConfigWithDateRange;
  modifierChain: ModifierChain;
  growthModel: GrowthModel;
};

/**
 * Adds `modelPathValue` to each time point: backfill steps from prior **observed** `value`,
 * snap to observed at forward-start index, then chain prior `modelPathValue` forward.
 *
 * Also adds `projectedPortfolioAtRetirement` to every non-projected (backfill + as-of) point:
 * - As-of point: the final `modelPathValue` in the series (free — already computed).
 * - Each backfill point: a forward chain from that point's actual observed `value` to the
 *   last point, using the same `stepInterval` logic. No full projection re-run; pure arithmetic.
 */
export function enrichContributorTimePointsWithModelPath(
  points: ProjectionTimePoint[],
  params: EnrichModelPathParams,
): ProjectionTimePoint[] {
  if (points.length === 0) {
    return points;
  }

  const { contributor, config, modifierChain, growthModel } = params;
  const projectionStartDate = new Date(config.startDate);
  const forwardStartIdx = findForwardStartIndex(points, projectionStartDate);

  // ── Pass 1: build modelPathValues (unchanged logic) ────────────────────────
  const modelPathValues: DecimalValueString[] = new Array(points.length);
  let annualBonusUsage = new Map<string, BonusAnnualUsage>();

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;

    if (i < forwardStartIdx) {
      if (i === 0) {
        modelPathValues[i] = point.value;
      } else {
        const prev = points[i - 1];
        if (!prev) {
          modelPathValues[i] = point.value;
          continue;
        }
        const step = stepInterval(
          growthModel,
          prev.value,
          prev.date,
          point.date,
          contributor,
          config,
          modifierChain,
          projectionStartDate,
          annualBonusUsage,
        );
        modelPathValues[i] = step.endValue;
        annualBonusUsage = step.annualBonusUsage;
      }
    } else if (i === forwardStartIdx) {
      modelPathValues[i] = point.value;
    } else {
      const prevMpv = modelPathValues[i - 1];
      const prevPoint = points[i - 1];
      if (prevMpv === undefined || !prevPoint) {
        modelPathValues[i] = point.value;
        continue;
      }
      const step = stepInterval(
        growthModel,
        prevMpv,
        prevPoint.date,
        point.date,
        contributor,
        config,
        modifierChain,
        projectionStartDate,
        annualBonusUsage,
      );
      modelPathValues[i] = step.endValue;
      annualBonusUsage = step.annualBonusUsage;
    }
  }

  // ── Pass 2: projectedPortfolioAtRetirement for non-projected points ────────
  // The as-of point's terminal value is the last modelPathValue (already computed).
  // Each backfill point runs a fresh forward chain from its observed `value`.
  const terminalValues: (DecimalValueString | undefined)[] = new Array(points.length);
  const terminalModelPathValue = modelPathValues[points.length - 1];

  for (let i = 0; i <= forwardStartIdx; i++) {
    const point = points[i];
    if (!point) continue;

    if (i === forwardStartIdx) {
      terminalValues[i] = terminalModelPathValue;
      continue;
    }

    // Backfill point: simulate forward from this point's observed value to the end.
    let runningValue: DecimalValueString = point.value;
    let runningBonusUsage = new Map<string, BonusAnnualUsage>();

    for (let j = i; j < points.length - 1; j++) {
      const from = points[j];
      const to = points[j + 1];
      if (!from || !to) continue;
      const step = stepInterval(
        growthModel,
        runningValue,
        from.date,
        to.date,
        contributor,
        config,
        modifierChain,
        projectionStartDate,
        runningBonusUsage,
      );
      runningValue = step.endValue;
      runningBonusUsage = step.annualBonusUsage;
    }

    terminalValues[i] = runningValue;
  }

  return points.map((p, i) => ({
    ...p,
    modelPathValue: modelPathValues[i] ?? p.value,
    ...(terminalValues[i] !== undefined
      ? { projectedPortfolioAtRetirement: terminalValues[i] }
      : {}),
  }));
}

// ============================================================================
// PORTFOLIO REACH (backward scan)
// ============================================================================

/**
 * First date at or after each index where portfolio `modelPathValue` >= `targetValue`.
 */
export function attachProjectedReachDates(
  points: ProjectionTimePoint[],
  targetValue: DecimalValueString,
): ProjectionTimePoint[] {
  const T = Decimal(targetValue);
  let nextReach: Date | null = null;
  const out: ProjectionTimePoint[] = new Array(points.length);

  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (!p) continue;

    const mpv = p.modelPathValue;
    if (mpv != null && Decimal(mpv).gte(T)) {
      nextReach = p.date;
    }

    out[i] = {
      ...p,
      projectedReachDate: nextReach,
    };
  }

  return out;
}
