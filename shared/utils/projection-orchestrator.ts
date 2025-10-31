import {
  ProjectionConfigWithDateRange,
  ProjectionResult,
  AssetProjection,
  ProjectionTimePoint,
  MilestoneTarget,
  MilestoneProgress,
  ProjectionOrhesratorAssetInput,
  ProjectionOrchestratorInput,
  ProjectionDataSource,
  Contributor,
  ContributorProjection,
  contributorProjectionSchema,
  ContributorSchedule,
  ComputationContext,
} from "@shared/schema/projections";
import { UserAsset, RecurringContribution, AccountType } from "@shared/schema";
//import { Database } from "@server/db";
import { createModifierChain } from "@shared/utils/projection-modifiers";
import {
  generateSimpleProjection,
  SimpleProjectionInput,
  SimpleProjectionResult,
} from "@shared/utils/projection-simple";
import {
  generateAdvancedProjection,
  AdvancedProjectionInput,
} from "./projection-advanced";
//import { assetValues, userAssets } from "@server/db/schema";
//import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  findTimePointAtOrBefore,
  extractAndSortDates,
} from "./projection-utils";

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
// SINGLE ASSET PROJECTION
// ============================================================================

/**
 * Project a single asset
 */
// async function projectSingleAsset(
//   asset: ProjectionOrhesratorAssetInput,
//   assetContributions: RecurringContribution[],
//   config: ProjectionConfigWithDateRange
//   //db: Database
//   //dataSource: ProjectionDataSource
// ): Promise<AssetProjection> {
//   const modifierChain = createModifierChain(config.modifiers);

//   let result: SimpleProjectionResult;

//   if (config.mode === "simple") {
//     const input: SimpleProjectionInput = {
//       currentValue: asset.currentValue,
//       currentDate: new Date(),
//       recurringContributions: assetContributions,
//       config,
//       modifierChain,
//     };
//     result = generateSimpleProjection(input);
//   } else {
//     throw new Error("Advanced projection not implemented");
//     // const input: AdvancedProjectionInput = {
//     //   assetId: asset.id,
//     //   currentValue: asset.currentValue,
//     //   currentDate: new Date(),
//     //   recurringContributions: assetContributions,
//     //   config,
//     //   modifierChain,
//     //   db,
//     // };
//     // result = await generateAdvancedProjection(input);
//   }

//   return {
//     assetId: asset.id,
//     assetName: asset.name,
//     accountType: asset.accountType,
//     currentValue: asset.currentValue,
//     projectedEndValue: result.finalValue,
//     timePoints: result.timePoints,
//   };
// }

/**
 * Project a single asset
 */
async function projectSingleContributor(
  contribution: Contributor,
  config: ProjectionConfigWithDateRange
): Promise<ContributorProjection> {
  const modifierChain = createModifierChain(config.modifiers);

  let result: SimpleProjectionResult;

  if (config.mode === "simple") {
    const input: SimpleProjectionInput = {
      currentValue: contribution.currentValue,
      currentDate: new Date(),
      //recurringContributions: assetContributions,
      scheduledContributions: contribution.schedules,
      config,
      modifierChain,
    };
    result = generateSimpleProjection(input);
  } else {
    throw new Error("Advanced projection not implemented");
    // const input: AdvancedProjectionInput = {
    //   assetId: asset.id,
    //   currentValue: asset.currentValue,
    //   currentDate: new Date(),
    //   recurringContributions: assetContributions,
    //   config,
    //   modifierChain,
    //   db,
    // };
    // result = await generateAdvancedProjection(input);
  }

  return {
    contributorReferenceId: contribution.referenceId,
    contributorName: contribution.name,
    accountType: contribution.accountType,
    currentValue: contribution.currentValue,
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
// function aggregateAssetTimePoints(
//   assetProjections: AssetProjection[]
// ): ProjectionTimePoint[] {
//   if (assetProjections.length === 0) {
//     return [];
//   }

//   // Extract all time series and get sorted unique dates
//   const timeSeries = assetProjections.map((p) => p.timePoints);
//   const sortedDates = extractAndSortDates(timeSeries);

//   // For each date, sum values from all assets
//   return sortedDates.map((date) => {
//     const timestamp = date.getTime();
//     let totalValue = 0;
//     let totalContributions = 0;
//     let totalGrowth = 0;
//     let hasProjected = false;

//     for (const projection of assetProjections) {
//       // Find the time point for this asset at this date (or closest before)
//       const point =
//         projection.timePoints.find((p) => p.date.getTime() === timestamp) ||
//         findTimePointAtOrBefore(projection.timePoints, date);

//       if (point) {
//         totalValue += point.value;
//         totalContributions += point.contributions;
//         totalGrowth += point.growth;
//         hasProjected = hasProjected || point.projectedValue;
//       }
//     }

//     return {
//       date,
//       value: totalValue,
//       contributions: totalContributions,
//       growth: totalGrowth,
//       projectedValue: hasProjected,
//     };
//   });
// }

function aggregateContributionTimePoints(
  contributorProjections: ContributorProjection[]
): ProjectionTimePoint[] {
  if (contributorProjections.length === 0) {
    return [];
  }

  // Extract all time series and get sorted unique dates
  const timeSeries = contributorProjections.map((p) => p.timePoints);
  const sortedDates = extractAndSortDates(timeSeries);

  // For each date, sum values from all assets
  return sortedDates.map((date) => {
    const timestamp = date.getTime();
    let totalValue = 0;
    let totalContributions = 0;
    let totalGrowth = 0;
    let hasProjected = false;

    for (const projection of contributorProjections) {
      // Find the time point for this asset at this date (or closest before)
      const point =
        projection.timePoints.find((p) => p.date.getTime() === timestamp) ||
        findTimePointAtOrBefore(projection.timePoints, date);

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
 * Orchestrate projection across one or more contributions
 */
export async function orchestrateProjection(
  input: ProjectionOrchestratorInput
  //dataSource: ProjectionDataSource
): Promise<ProjectionOrchestratorResult> {
  //const { assets, recurringContributions, config, milestoneTarget } = input;
  const { contributors, config, milestoneTarget } = input;

  // Filter assets by milestone account type if specified
  //let assetsToProject = assets;
  let contributorsToProject = contributors;
  // if (milestoneTarget?.accountType) {
  //   assetsToProject = assets.filter(
  //     (asset) => asset.accountType === milestoneTarget.accountType
  //   );
  // }

  // if (assetsToProject.length === 0) {
  //   throw new Error("No assets found to project");
  // }

  // Project each asset
  //const assetProjections: AssetProjection[] = [];
  const contributorProjections: ContributorProjection[] = [];
  const warnings: string[] = [];


  for (const contributor of contributorsToProject) {
    try {
      // Get contributions for this asset
      // const assetContributions = recurringContributions.filter(
      //   (c) => c.assetId === asset.id
      // );

      // const projection = await projectSingleAsset(
      //   asset,
      //   assetContributions,
      //   config
      //   //db
      // );

      const projection = await projectSingleContributor(contributor, config);

      contributorProjections.push(projection);
    } catch (error) {
      warnings.push(
        //`Failed to project asset ${asset.name}: ${
        `Failed to project contributor ${contributor.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  //if (assetProjections.length === 0) {
  if (contributorProjections.length === 0) {
    throw new Error("All asset projections failed");
  }

  // Aggregate into portfolio-wide time points
  //const portfolioTimePoints = aggregateAssetTimePoints(assetProjections);
  const portfolioTimePoints = aggregateContributionTimePoints(
    contributorProjections
  );

  // Calculate totals
  // const totalCurrentValue = assetsToProject.reduce(
  //   (sum, asset) => sum + asset.currentValue,
  //   0
  // );
  const totalCurrentValue = contributorsToProject.reduce(
    (sum, contributor) => sum + contributor.currentValue,
    0
  );

  const lastPoint = portfolioTimePoints[portfolioTimePoints.length - 1];
  const totalProjectedValue = lastPoint?.value || totalCurrentValue;
  const totalContributions = lastPoint?.contributions || 0;
  const totalGrowth =
    totalProjectedValue - totalCurrentValue - totalContributions;

  // Build computation context for client-side adjustments
  const computationContext: ComputationContext = {
    contributors: contributorsToProject,
    // assets: contributionsToProject.map((asset) => ({
    //   id: asset.id,
    //   name: asset.name,
    //   accountType: asset.accountType,
    //   currentValue: asset.currentValue,
    // })),
    // recurringContributions: input.recurringContributions.map(
    //   (contribution) => ({
    //     id: contribution.id,
    //     assetId: contribution.assetId,
    //     amount: contribution.amount,
    //     isActive: contribution.isActive,
    //     startDate: contribution.startDate,
    //     patternConfig: contribution.patternConfig,
    //     process: contribution.process,
    //   })
    // ),
  };

  // Build result
  const result: ProjectionOrchestratorResult = {
    config,
    totalCurrentValue,
    totalProjectedValue,
    totalGrowth,
    totalContributions,
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
        referenceId: assetId,
        //We have to cast here until the db is using enum type for accountType
        accountType: asset.accountType as AccountType,
        name: asset.name,
        type: "asset",
        accessPIT: [],
        currentValue: asset.currentValue,
        schedules: recurringContributions.map((c) => ({
          patternConfig: c.patternConfig,
          value: c.amount,
          startDate: c.startDate,
          endDate: null,
          //endDate is not implemented on recurring contributions yet, it should be
          //endDate: c.endDate,
        })),
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

  const assets = await dataSource.getAssets();

  return orchestrateProjection({
    contributors: mapAssetsToContributors(assets),
    config,
    //db,
    milestoneTarget,
  });
}

export function mapRecurringContributionToContributorSchedule(
  recurringContribution: RecurringContribution
): ContributorSchedule {
  return {
    patternConfig: recurringContribution.patternConfig,
    value: recurringContribution.amount,
    startDate: recurringContribution.startDate,
    endDate: null,
  };
}

export function mapRecurringContributionsToContributorSchedules(
  recurringContributions: RecurringContribution[]
): ContributorSchedule[] {
  return recurringContributions.map(
    mapRecurringContributionToContributorSchedule
  );
}

export function mapAssetToContributor(
  asset: ProjectionOrhesratorAssetInput
): Contributor {
  return {
    referenceId: asset.id,
    accountType: asset.accountType as AccountType,
    name: asset.name,
    type: "asset",
    accessPIT: [],
    currentValue: asset.currentValue,
    schedules: mapRecurringContributionsToContributorSchedules(
      asset.recurringContributions
    ),
  };
}

export function mapAssetsToContributors(
  assets: ProjectionOrhesratorAssetInput[]
): Contributor[] {
  return assets.map(mapAssetToContributor);
}