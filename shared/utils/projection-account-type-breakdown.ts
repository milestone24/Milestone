import type {
  ContributorProjection,
  FireProjectionData,
  ProjectionTimePoint,
} from "@shared/schema/projections";
import {
  createDecimalValueString,
  DecimalValueString,
} from "@shared/schema";
import Decimal from "decimal.js";
import { convertToAgeBasedProjection } from "./projection-utils";

const FALLBACK_ACCOUNT_TYPE = "OTHER";

type DateAccumulator = Map<string, { value: Decimal; date: Date }>;

function accumulateContributor(
  contributor: ContributorProjection,
  accumulator: Map<string, DateAccumulator>
): void {
  const accountType = contributor.accountType ?? FALLBACK_ACCOUNT_TYPE;

  if (!accumulator.has(accountType)) {
    accumulator.set(accountType, new Map());
  }

  const dateMap = accumulator.get(accountType)!;

  for (const point of contributor.timePoints) {
    const key = point.date.toISOString();
    const existing = dateMap.get(key);

    if (existing) {
      existing.value = existing.value.plus(Decimal(point.value));
    } else {
      dateMap.set(key, { value: Decimal(point.value), date: point.date });
    }
  }
}

function buildTimePoints(dateMap: DateAccumulator): ProjectionTimePoint[] {
  return Array.from(dateMap.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ value, date }) => ({
      date,
      value: createDecimalValueString(value.toString()),
      contributions: createDecimalValueString("0"),
      growth: createDecimalValueString("0"),
      projectedValue: true,
    }));
}

/**
 * Aggregates a contributor breakdown by account type, returning a map of
 * account type → age-based projection series.
 *
 * Supports option 2.2.b: reduces per-contributor time series from
 * projectionResult.contributorBreakdown into one summed series per account
 * type, suitable for a stacked area chart.
 *
 * The chart hook accepts the same Map<string, FireProjectionData[]> shape
 * regardless of whether it was produced here (2.2.b) or from per-contributor
 * data (2.1), so the caller decides which granularity to pass.
 */
export function aggregateContributorBreakdownByAccountType(
  contributorBreakdown: ContributorProjection[],
  dateOfBirth: Date,
  target: DecimalValueString
): Map<string, FireProjectionData[]> {
  const accumulator = new Map<string, DateAccumulator>();

  for (const contributor of contributorBreakdown) {
    accumulateContributor(contributor, accumulator);
  }

  const result = new Map<string, FireProjectionData[]>();

  for (const [accountType, dateMap] of accumulator) {
    const timePoints = buildTimePoints(dateMap);
    result.set(accountType, convertToAgeBasedProjection(timePoints, dateOfBirth, target));
  }

  return result;
}
