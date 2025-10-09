import {
  ProjectionConfig,
  ProjectionResult,
  AssetProjection,
  ProjectionTimePoint,
  MilestoneTarget,
  MilestoneProgress,
} from "@shared/schema/projections";
import { UserAsset, RecurringContribution } from "@shared/schema";
import { Database } from "@server/db";
import { createModifierChain } from "./modifiers";
import {
  generateSimpleProjection,
  SimpleProjectionInput,
  SimpleProjectionResult,
} from "./simple";
import {
  generateAdvancedProjection,
  AdvancedProjectionInput,
} from "./advanced";
import { assetValues, userAssets } from "@server/db/schema";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";

// ============================================================================
// PROJECTION ORCHESTRATOR
// ============================================================================

/**
 * Input for orchestrating projections
 */
export interface ProjectionOrchestratorInput {
  assets: UserAsset[];
  recurringContributions: RecurringContribution[]; // All contributions for all assets
  config: ProjectionConfig;
  db: Database;
  milestoneTarget?: MilestoneTarget;
}

/**
 * Result from orchestrator
 */
export interface ProjectionOrchestratorResult extends ProjectionResult {
  // Extends ProjectionResult with full type
}

// ============================================================================
// SINGLE ASSET PROJECTION
// ============================================================================

/**
 * Project a single asset
 */
async function projectSingleAsset(
  asset: UserAsset,
  assetContributions: RecurringContribution[],
  config: ProjectionConfig,
  db: Database
): Promise<AssetProjection> {
  const modifierChain = createModifierChain(config.modifiers);

  let result: SimpleProjectionResult;

  if (config.mode === "simple") {
    const input: SimpleProjectionInput = {
      currentValue: asset.currentValue,
      currentDate: new Date(),
      recurringContributions: assetContributions,
      config,
      modifierChain,
    };
    result = generateSimpleProjection(input);
  } else {
    const input: AdvancedProjectionInput = {
      assetId: asset.id,
      currentValue: asset.currentValue,
      currentDate: new Date(),
      recurringContributions: assetContributions,
      config,
      modifierChain,
      db,
    };
    result = await generateAdvancedProjection(input);
  }

  return {
    assetId: asset.id,
    assetName: asset.name,
    accountType: asset.accountType,
    currentValue: asset.currentValue,
    projectedEndValue: result.finalValue,
    timePoints: result.timePoints,
  };
}

// ============================================================================
// PORTFOLIO PROJECTION
// ============================================================================

/**
 * Aggregate time points from multiple assets into portfolio-wide time points
 */
function aggregateAssetTimePoints(
  assetProjections: AssetProjection[]
): ProjectionTimePoint[] {
  if (assetProjections.length === 0) {
    return [];
  }

  // Collect all unique dates
  const datesSet = new Set<number>();
  for (const projection of assetProjections) {
    for (const point of projection.timePoints) {
      datesSet.add(point.date.getTime());
    }
  }

  const sortedDates = Array.from(datesSet).sort();

  // For each date, sum values from all assets
  return sortedDates.map((timestamp) => {
    const date = new Date(timestamp);
    let totalValue = 0;
    let totalContributions = 0;
    let totalGrowth = 0;
    let hasProjected = false;

    for (const projection of assetProjections) {
      // Find the time point for this asset at this date (or closest before)
      const point =
        projection.timePoints.find((p) => p.date.getTime() === timestamp) ||
        findClosestBeforeDate(projection.timePoints, date);

      if (point) {
        totalValue += point.value;
        totalContributions += point.contributions;
        totalGrowth += point.growth;
        hasProjected = hasProjected || point.projectedValue;
      }
    }

    return {
      date,
      value: totalValue,
      contributions: totalContributions,
      growth: totalGrowth,
      projectedValue: hasProjected,
    };
  });
}

/**
 * Find the closest time point before or on the given date
 */
function findClosestBeforeDate(
  points: ProjectionTimePoint[],
  targetDate: Date
): ProjectionTimePoint | undefined {
  let closest: ProjectionTimePoint | undefined;

  for (const point of points) {
    if (point.date <= targetDate) {
      if (!closest || point.date > closest.date) {
        closest = point;
      }
    }
  }

  return closest;
}

// ============================================================================
// MILESTONE PROGRESS CALCULATION
// ============================================================================

/**
 * Calculate milestone progress from projection result
 */
function calculateMilestoneProgress(
  projectionResult: ProjectionResult,
  milestone: MilestoneTarget
): MilestoneProgress {
  // Find the projected value at the target date (if specified)
  let projectedValueAtTarget: number;

  if (milestone.targetDate) {
    const targetPoint =
      projectionResult.timePoints.find(
        (p) => p.date.getTime() === milestone.targetDate?.getTime()
      ) ||
      findClosestBeforeDate(projectionResult.timePoints, milestone.targetDate);

    projectedValueAtTarget =
      targetPoint?.value || projectionResult.totalCurrentValue;
  } else {
    // No target date specified, use final projected value
    projectedValueAtTarget = projectionResult.totalProjectedValue;
  }

  const shortfall = milestone.targetValue - projectedValueAtTarget;
  const shortfallPercentage = (shortfall / milestone.targetValue) * 100;
  const isOnTrack = shortfall <= 0;

  return {
    milestoneId: milestone.milestoneId,
    milestoneName: milestone.milestoneName,
    targetValue: milestone.targetValue,
    targetDate: milestone.targetDate,
    projectedValueAtTarget,
    isOnTrack,
    shortfall,
    shortfallPercentage,
  };
}

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Orchestrate projection across one or more assets
 */
export async function orchestrateProjection(
  input: ProjectionOrchestratorInput
): Promise<ProjectionOrchestratorResult> {
  const { assets, recurringContributions, config, db, milestoneTarget } = input;

  // Filter assets by milestone account type if specified
  let assetsToProject = assets;
  if (milestoneTarget?.accountType) {
    assetsToProject = assets.filter(
      (asset) => asset.accountType === milestoneTarget.accountType
    );
  }

  if (assetsToProject.length === 0) {
    throw new Error("No assets found to project");
  }

  // Project each asset
  const assetProjections: AssetProjection[] = [];
  const warnings: string[] = [];

  for (const asset of assetsToProject) {
    try {
      // Get contributions for this asset
      const assetContributions = recurringContributions.filter(
        (c) => c.assetId === asset.id
      );

      const projection = await projectSingleAsset(
        asset,
        assetContributions,
        config,
        db
      );

      assetProjections.push(projection);
    } catch (error) {
      warnings.push(
        `Failed to project asset ${asset.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  if (assetProjections.length === 0) {
    throw new Error("All asset projections failed");
  }

  // Aggregate into portfolio-wide time points
  const portfolioTimePoints = aggregateAssetTimePoints(assetProjections);

  // Calculate totals
  const totalCurrentValue = assetsToProject.reduce(
    (sum, asset) => sum + asset.currentValue,
    0
  );

  const lastPoint = portfolioTimePoints[portfolioTimePoints.length - 1];
  const totalProjectedValue = lastPoint?.value || totalCurrentValue;
  const totalContributions = lastPoint?.contributions || 0;
  const totalGrowth =
    totalProjectedValue - totalCurrentValue - totalContributions;

  // Build result
  const result: ProjectionOrchestratorResult = {
    config,
    totalCurrentValue,
    totalProjectedValue,
    totalGrowth,
    totalContributions,
    timePoints: portfolioTimePoints,
    assetBreakdown: assetProjections,
    calculatedAt: new Date(),
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  // Calculate milestone progress if requested
  if (milestoneTarget) {
    result.milestoneProgress = [
      calculateMilestoneProgress(result, milestoneTarget),
    ];
  }

  return result;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Project a single asset by ID
 */
export async function projectAssetById(
  assetId: string,
  config: ProjectionConfig,
  db: Database
): Promise<ProjectionResult> {
  const asset = await db.query.userAssets.findFirst({
    where: (userAssets, { eq }) => eq(userAssets.id, assetId),
  });

  if (!asset) {
    throw new Error(`Asset ${assetId} not found`);
  }

  const contributions = await db.query.recurringContributions.findMany({
    where: (recurringContributions, { eq }) =>
      eq(recurringContributions.assetId, assetId),
  });

  return orchestrateProjection({
    assets: [asset],
    recurringContributions: contributions,
    config,
    db,
  });
}

/**
 * Project entire portfolio for a user
 */
export async function projectPortfolio(
  userAccountId: string,
  config: ProjectionConfig,
  db: Database,
  milestoneTarget?: MilestoneTarget
): Promise<ProjectionResult> {
  // Use LATERAL join to efficiently get only the latest value per asset
  // This only fetches one row per asset instead of ranking all values
  const assets = await db
    .select({
      ...getTableColumns(userAssets),
      currentValue: sql<number>`COALESCE(latest_value.value, ${userAssets.currentValue})`,
    })
    .from(userAssets)
    .leftJoin(
      sql`LATERAL (
        SELECT ${assetValues.value}, ${assetValues.valueDate}
        FROM ${assetValues}
        WHERE ${assetValues.assetId} = ${userAssets.id}
        ORDER BY ${assetValues.valueDate} DESC
        LIMIT 1
      ) AS latest_value`,
      sql`true`
    )
    .where(eq(userAssets.userAccountId, userAccountId));

  if (assets.length === 0) {
    throw new Error("No assets found for user");
  }

  const contributions = await db.query.recurringContributions.findMany({
    where: (recurringContributions, { inArray }) =>
      inArray(
        recurringContributions.assetId,
        assets.map((a) => a.id)
      ),
  });

  return orchestrateProjection({
    assets,
    recurringContributions: contributions,
    config,
    db,
    milestoneTarget,
  });
}

