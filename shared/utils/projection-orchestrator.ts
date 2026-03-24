import {
  ProjectionConfigWithDateRange,
  ProjectionResult,
  ProjectionTimePoint,
  MilestoneTarget,
  MilestoneProgress,
  ProjectionOrchestratorInput,
  ProjectionDataSource,
  Contributor,
  ContributorProjection,
  ComputationContext,
  AdvancedProjectionConfigWithDateRange,
} from "@shared/schema/projections";
import {
  AccountType,
  createDecimalValueString,
  DecimalValueString,
} from "@shared/schema";
import {
  createModifierChain,
  unifyModifiersForContributor,
  getModifiersAsGlobalList,
} from "@shared/utils/projection-modifiers";
import {
  generateSimpleProjection,
  SimpleProjectionInput,
  SimpleProjectionResult,
} from "@shared/utils/projection-simple";
import {
  findTimePointAtOrBefore,
  extractAndSortDates,
  calculateYearsToTarget,
} from "./projection-utils";
import {
  enrichContributorTimePointsWithModelPath,
  attachProjectedReachDates,
} from "./projection-model-path";
import type { SimpleProjectionConfigWithDateRange } from "@shared/schema/projections";
import Decimal from "decimal.js";
import { addYears } from "date-fns";

// ============================================================================
// PROJECTION ORCHESTRATOR
// ============================================================================

/**
 * Result from orchestrator
 */
export interface ProjectionOrchestratorResult extends ProjectionResult {
  // Extends ProjectionResult with full type
}

// ============================================================================
// SINGLE Contriutor PROJECTION
// ============================================================================

/**
 * Project a single conributor
 */
export async function projectSingleContributor(
  contribution: Contributor,
  config: ProjectionConfigWithDateRange,
  dateOfBirth?: Date
): Promise<ContributorProjection> {
  const modifierChain = createModifierChain(
    unifyModifiersForContributor(contribution, config.modifiers)
  );

  let result: SimpleProjectionResult;

  if (config.mode === "simple") {
    const input: SimpleProjectionInput = {
      currentValue: contribution.currentValue,
      currentDate: new Date(),
      scheduledContributions: contribution.schedules,
      contributor: contribution,
      dateOfBirth: dateOfBirth,
      config,
      modifierChain,
    };
    result = generateSimpleProjection(input);
    const simpleConfig = config as SimpleProjectionConfigWithDateRange;
    result = {
      ...result,
      timePoints: enrichContributorTimePointsWithModelPath(result.timePoints, {
        contributor: contribution,
        config: simpleConfig,
        modifierChain,
        growthModel: simpleConfig.growthModel,
      }),
    };
  } else {
    throw new Error("Advanced projection not implemented");
  }

  return {
    contributorReferenceId: contribution.referenceId,
    contributorName: contribution.name,
    platformName: contribution.platformName,
    accountType: contribution.accountType,
    currentValue: contribution.currentValue,
    projectedEndValue: result.finalValue,
    timePoints: result.timePoints,
  };
}

// ============================================================================
// PORTFOLIO PROJECTION
// ============================================================================

function aggregateContributionTimePoints(
  contributorProjections: ContributorProjection[]
): ProjectionTimePoint[] {
  if (contributorProjections.length === 0) {
    return [];
  }

  // Extract all time series and get sorted unique dates
  const timeSeries = contributorProjections.map((p) => p.timePoints);
  const sortedDates = extractAndSortDates(timeSeries);

  // For each date, sum values from all contributors
  return sortedDates.map((date) => {
    const timestamp = date.getTime();
    let totalValue = 0;
    let totalContributions = 0;
    let totalGrowth = 0;
    let totalBonuses = 0;
    let totalAccessibleValue = 0;
    let totalLockedValue = 0;
    let totalModelPath = 0;
    let hasModelPath = false;
    let totalTerminalValue = 0;
    let hasTerminalValue = false;
    let hasProjected = false;
    let hasBonuses = false;
    let hasAccessible = false;

    for (const projection of contributorProjections) {
      // Find the time point for this contributor at this date (or closest before)
      const point =
        projection.timePoints.find((p) => p.date.getTime() === timestamp) ||
        findTimePointAtOrBefore(projection.timePoints, date);

      if (point) {
        totalValue = Decimal(point.value).add(totalValue).toNumber();
        totalContributions = Decimal(point.contributions)
          .add(totalContributions)
          .toNumber();
        totalGrowth = Decimal(point.growth).add(totalGrowth).toNumber();
        hasProjected = hasProjected || point.projectedValue;

        if (point.bonuses) {
          totalBonuses = Decimal(point.bonuses).add(totalBonuses).toNumber();
          hasBonuses = true;
        }

        if (point.accessibleValue) {
          totalAccessibleValue = Decimal(point.accessibleValue)
            .add(totalAccessibleValue)
            .toNumber();
          hasAccessible = true;
        }

        if (point.lockedValue) {
          totalLockedValue = Decimal(point.lockedValue)
            .add(totalLockedValue)
            .toNumber();
          hasAccessible = true;
        }

        if (point.modelPathValue) {
          hasModelPath = true;
          totalModelPath = Decimal(point.modelPathValue)
            .add(totalModelPath)
            .toNumber();
        }

        if (point.projectedPortfolioAtRetirement) {
          hasTerminalValue = true;
          totalTerminalValue = Decimal(point.projectedPortfolioAtRetirement)
            .add(totalTerminalValue)
            .toNumber();
        }
      }
    }

    return {
      date,
      value: createDecimalValueString(Decimal(totalValue).toString()),
      contributions: createDecimalValueString(
        Decimal(totalContributions).toString()
      ),
      growth: createDecimalValueString(Decimal(totalGrowth).toString()),
      bonuses: hasBonuses
        ? createDecimalValueString(Decimal(totalBonuses).toString())
        : undefined,
      accessibleValue: hasAccessible
        ? createDecimalValueString(Decimal(totalAccessibleValue).toString())
        : undefined,
      lockedValue: hasAccessible
        ? createDecimalValueString(Decimal(totalLockedValue).toString())
        : undefined,
      projectedValue: hasProjected,
      ...(hasModelPath
        ? {
            modelPathValue: createDecimalValueString(
              Decimal(totalModelPath).toString(),
            ),
          }
        : {}),
      ...(hasTerminalValue
        ? {
            projectedPortfolioAtRetirement: createDecimalValueString(
              Decimal(totalTerminalValue).toString(),
            ),
          }
        : {}),
    };
  });
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
      findTimePointAtOrBefore(
        projectionResult.timePoints,
        milestone.targetDate
      );

    projectedValueAtTarget = Decimal(
      targetPoint?.value || projectionResult.totalCurrentValue
    ).toNumber();
  } else {
    // No target date specified, use final projected value
    projectedValueAtTarget = Decimal(
      projectionResult.totalProjectedValue
    ).toNumber();
  }

  const shortfall = Decimal(milestone.targetValue)
    .sub(Decimal(projectedValueAtTarget))
    .toNumber();
  const shortfallPercentage = Decimal(shortfall)
    .div(Decimal(milestone.targetValue))
    .mul(100)
    .toNumber();
  const isOnTrack = shortfall <= 0;

  return {
    milestoneId: milestone.milestoneId,
    milestoneName: milestone.milestoneName,
    targetValue: milestone.targetValue,
    targetDate: milestone.targetDate,
    projectedValueAtTarget: createDecimalValueString(
      Decimal(projectedValueAtTarget).toString()
    ),
    isOnTrack,
    shortfall: createDecimalValueString(Decimal(shortfall).toString()),
    shortfallPercentage,
  };
}

// ============================================================================
// REACH DATE EXTRAPOLATION
// ============================================================================

/**
 * For non-projected time points that still have a null projectedReachDate after the
 * within-window backward scan, extrapolates beyond the projection window using each
 * point's projectedPortfolioAtRetirement value and calculateYearsToTarget.
 */
function extrapolateReachDatesForPoints(
  points: ProjectionTimePoint[],
  targetValue: DecimalValueString,
  contributors: Contributor[],
  config: ProjectionConfigWithDateRange,
): ProjectionTimePoint[] {
  const nonProjectedPoints = points.filter((p) => !p.projectedValue);
  const needsExtrapolation = nonProjectedPoints.some(
    (p) => p.projectedReachDate === null && p.projectedPortfolioAtRetirement != null,
  );

  if (!needsExtrapolation) {
    return points;
  }

  const growthRate =
    config.mode === "simple"
      ? (config as SimpleProjectionConfigWithDateRange).growthRate
      : (config as AdvancedProjectionConfigWithDateRange).anticipatedGrowthRate ?? 7;

  const modifierChain = createModifierChain(
    getModifiersAsGlobalList(config.modifiers),
  );

  const contributorsForProjection = contributors.filter(
    (c) => c.includeContributions,
  );

  const endDate = config.endDate;

  return points.map((p) => {
    if (
      p.projectedValue ||
      p.projectedReachDate !== null ||
      p.projectedPortfolioAtRetirement == null
    ) {
      return p;
    }

    const extraYears = calculateYearsToTarget(
      p.projectedPortfolioAtRetirement,
      contributorsForProjection,
      growthRate,
      targetValue,
      modifierChain,
      { startDate: endDate, maxYears: 100 },
    );

    if (extraYears === Infinity) {
      return p;
    }

    return {
      ...p,
      projectedReachDate: addYears(endDate, extraYears),
    };
  });
}

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Orchestrate projection across one or more contributions
 */
export async function orchestrateProjection(
  input: ProjectionOrchestratorInput
  //dataSource: ProjectionDataSource
): Promise<ProjectionOrchestratorResult> {
  const { contributors, config, milestoneTarget, dateOfBirth, targetValue } = input;

  let contributorsToProject = contributors
    .filter((contributor) => contributor.includeContributions);

  const warnings: string[] = [];

  // Project each contributor

  const contributorProjections: ContributorProjection[] = await Promise.all(
    contributorsToProject
      .map((contributor) =>
      projectSingleContributor(contributor, config, dateOfBirth)
    )
  );

  if (contributorProjections.length === 0) {
    throw new Error("All asset projections failed");
  }

  // Aggregate into portfolio-wide time points
  //const portfolioTimePoints = aggregateAssetTimePoints(assetProjections);
  const portfolioTimePoints = aggregateContributionTimePoints(
    contributorProjections
  );

  const totalCurrentValue = contributors
    .filter((contributor) => contributor.includeValue)
    .reduce(
    (sum, contributor) =>
      Decimal(sum).add(Decimal(contributor.currentValue)).toNumber(),
    0
  );

  const lastPoint = portfolioTimePoints[portfolioTimePoints.length - 1];
  const totalProjectedValue = lastPoint?.value || totalCurrentValue;
  const totalContributions = lastPoint?.contributions || 0;
  const totalBonuses = lastPoint?.bonuses || 0;
  // Growth = totalProjectedValue - currentValue - userContributions - bonuses
  // Note: totalContributions now excludes bonuses (user money only)
  const totalGrowth = Decimal(totalProjectedValue)
    .sub(Decimal(totalCurrentValue))
    .sub(Decimal(totalContributions))
    .sub(Decimal(totalBonuses))
    .toNumber();

  // Build computation context for client-side adjustments
  const computationContext: ComputationContext = {
    //We need to include all contributors, not just the ones that are being projected
    //So that when preview is running this code it can see all contributors
    //for thos of invludeValue and includeContributions
    contributors,
  };

  // Build result
  const result: ProjectionOrchestratorResult = {
    config,
    totalCurrentValue: createDecimalValueString(
      Decimal(totalCurrentValue).toString()
    ),
    totalProjectedValue: createDecimalValueString(
      Decimal(totalProjectedValue).toString()
    ),
    totalGrowth: createDecimalValueString(Decimal(totalGrowth).toString()),
    totalContributions: createDecimalValueString(
      Decimal(totalContributions).toString()
    ),
    totalBonuses: createDecimalValueString(
      Decimal(totalBonuses).toString()
    ),
    timePoints: portfolioTimePoints,
    contributorBreakdown: contributorProjections,
    computedAt: new Date(),
    warnings: warnings.length > 0 ? warnings : undefined,
    computationContext,
  };

  // Calculate milestone progress if requested
  if (milestoneTarget) {
    result.milestoneProgress = [
      calculateMilestoneProgress(result, milestoneTarget),
    ];
  }

  // Attach projected reach dates when a target value is provided
  if (targetValue) {
    result.timePoints = attachProjectedReachDates(result.timePoints, targetValue);
    result.timePoints = extrapolateReachDatesForPoints(
      result.timePoints,
      targetValue,
      contributors,
      config,
    );
  }

  return result;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Project a single asset by ID
 */
export async function projectAsset(
  assetId: string,
  config: ProjectionConfigWithDateRange,
  dataSource: ProjectionDataSource
): Promise<ProjectionResult> {
  const asset = await dataSource.getAssetById(assetId);
  const recurringContributions = await dataSource.getContributionsForAssets([
    assetId,
  ]);

  // const asset = await db.query.userAssets.findFirst({
  //   where: (userAssets, { eq }) => eq(userAssets.id, assetId),
  // });

  if (!asset) {
    throw new Error(`Asset ${assetId} not found`);
  }

  // const contributions = await db.query.recurringContributions.findMany({
  //   where: (recurringContributions, { eq }) =>
  //     eq(recurringContributions.assetId, assetId),
  // });

  return orchestrateProjection({
    //assets: [asset],
    //recurringContributions,
    contributors: [
      {
        id: crypto.randomUUID(),
        referenceId: assetId,
        //We have to cast here until the db is using enum type for accountType
        accountType: asset.accountType as AccountType,
        name: asset.name,
        type: "asset",
        valueReleases: [],
        currentValue: asset.currentValue,
        schedules: recurringContributions.map((c) => ({
          patternConfig: c.patternConfig,
          value: c.amount,
          startDate: c.startDate,
          endDate: null,
          //endDate is not implemented on recurring contributions yet, it should be
          //endDate: c.endDate,
        })),
        includeValue: true,
        includeContributions: true,
      },
    ],
    config,
    //db,
  });
}

/**
 * Project entire portfolio for a user
 */
export async function projectPortfolio(
  //assets: ProjectionOrhesratorAssetInput[],
  config: ProjectionConfigWithDateRange,
  dataSource: ProjectionDataSource,
  contributors: Contributor[],
  milestoneTarget?: MilestoneTarget
): Promise<ProjectionResult> {
  // Use LATERAL join to efficiently get only the latest value per asset
  // This only fetches one row per asset instead of ranking all values

  // if (assets.length === 0) {
  //   throw new Error("No assets found for user");
  // }

  // const contributions = await db.query.recurringContributions.findMany({
  //   where: (recurringContributions, { inArray }) =>
  //     inArray(
  //       recurringContributions.assetId,
  //       assets.map((a) => a.id)
  //     ),
  // });

  //const assets = await dataSource.getAssets();

  return orchestrateProjection({
    //contributors: mapAssetsToContributors(assets),
    contributors,
    config,
    //db,
    milestoneTarget,
  });
}