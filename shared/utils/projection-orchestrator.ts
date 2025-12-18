import {
  ProjectionConfigWithDateRange,
  ProjectionResult,
  AssetProjection,
  ProjectionTimePoint,
  MilestoneTarget,
  MilestoneProgress,
  ProjectionOrchestratorAssetInput,
  ProjectionOrchestratorInput,
  ProjectionDataSource,
  Contributor,
  ContributorProjection,
  contributorProjectionSchema,
  ContributorSchedule,
  ComputationContext,
} from "@shared/schema/projections";
import {
  UserAsset,
  RecurringContribution,
  AccountType,
  createDecimalValueString,
} from "@shared/schema";
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
import Decimal from "decimal.js";

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
  config: ProjectionConfigWithDateRange,
  dateOfBirth?: Date
): Promise<ContributorProjection> {
  const modifierChain = createModifierChain(config.modifiers);

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
  } else {
    throw new Error("Advanced projection not implemented");
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

  // For each date, sum values from all contributors
  return sortedDates.map((date) => {
    const timestamp = date.getTime();
    let totalValue = 0;
    let totalContributions = 0;
    let totalGrowth = 0;
    let totalBonuses = 0;
    let totalAccessibleValue = 0;
    let totalLockedValue = 0;
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
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Orchestrate projection across one or more contributions
 */
export async function orchestrateProjection(
  input: ProjectionOrchestratorInput
  //dataSource: ProjectionDataSource
): Promise<ProjectionOrchestratorResult> {
  const { contributors, config, milestoneTarget, dateOfBirth } = input;

  // Filter contributors by milestone account type if specified
  let contributorsToProject = contributors;
  // if (milestoneTarget?.accountType) {
  //   contributorsToProject = contributors.filter(
  //     (contributor) => contributor.accountType === milestoneTarget.accountType
  //   );
  // }

  // Project each contributor
  const contributorProjections: ContributorProjection[] = [];
  const warnings: string[] = [];

  for (const contributor of contributorsToProject) {
    try {
      const projection = await projectSingleContributor(
        contributor,
        config,
        dateOfBirth
      );

      contributorProjections.push(projection);
    } catch (error) {
      warnings.push(
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