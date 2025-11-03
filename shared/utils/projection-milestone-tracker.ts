import {
  MilestoneTarget,
  MilestoneProgress,
  ProjectionConfig,
  ProjectionConfigWithDateRange,
  ProjectionDataSource,
} from "@shared/schema/projections";
//import { Database } from "@server/db";
import { milestones, userAssets } from "@server/db/schema";
//import { eq } from "drizzle-orm";
import { projectPortfolio } from "./projection-orchestrator";

// ============================================================================
// MILESTONE PROGRESS TRACKING
// ============================================================================

/**
 * Check if user is on track for a specific milestone
 */
export async function checkMilestoneProgress(
  milestoneTarget: MilestoneTarget,
  //milestoneId: string,
  config: ProjectionConfigWithDateRange,
  dataSource: ProjectionDataSource
  //db: Database
): Promise<MilestoneProgress> {
  // Fetch milestone details
  // const milestone = await db.query.milestones.findFirst({
  //   where: eq(milestones.id, milestoneId),
  // });

  // if (!milestone) {
  //   throw new Error(`Milestone ${milestoneId} not found`);
  // }

  // Create milestone target from database record
  // const milestoneTarget: MilestoneTarget = {
  //   milestoneId: milestone.id,
  //   milestoneName: milestone.name,
  //   targetValue: Number(milestone.targetValue),
  //   targetDate: config.endDate, // Use projection end date as target
  //   accountType: milestone.accountType,
  // };

  // Run projection for relevant assets
  const projectionResult = await projectPortfolio(
    //milestone.userAccountId,
    config,
    dataSource,
    milestoneTarget
  );

  // Extract milestone progress (orchestrator calculates it)
  const progress = projectionResult.milestoneProgress?.[0];

  if (!progress) {
    throw new Error("Milestone progress calculation failed");
  }

  return progress;
}

/**
 * Calculate shortfall between projected and target value
 */
export function calculateShortfall(
  projectedValue: number,
  targetValue: number
): {
  shortfall: number;
  shortfallPercentage: number;
  isOnTrack: boolean;
} {
  const shortfall = targetValue - projectedValue;
  const shortfallPercentage = (shortfall / targetValue) * 100;

  return {
    shortfall,
    shortfallPercentage,
    isOnTrack: shortfall <= 0,
  };
}

/**
 * Calculate additional monthly contribution needed to reach milestone
 */
export function recommendContributionAdjustment(
  currentMonthlyContribution: number,
  shortfall: number,
  monthsRemaining: number,
  annualGrowthRate: number
): number {
  if (monthsRemaining <= 0) {
    return 0;
  }

  // Calculate additional monthly contribution needed
  // Using future value of annuity formula solved for payment:
  // FV = PMT × [((1 + r)^n - 1) / r]
  // PMT = FV / [((1 + r)^n - 1) / r]

  const monthlyRate = annualGrowthRate / 100 / 12;

  if (monthlyRate === 0) {
    // No growth, simple division
    return shortfall / monthsRemaining;
  }

  const futureValueFactor =
    (Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate;
  const additionalMonthlyContribution = shortfall / futureValueFactor;

  return Math.max(0, additionalMonthlyContribution);
}

/**
 * Filter assets by milestone account type
 * Seems to be obsolete, to check
 */
// export async function filterAssetsByMilestone(
//   userAccountId: string,
//   accountType: string | null,
//   db: Database
// ) {
//   if (accountType === null) {
//     // Null means portfolio-wide, return all assets
//     return db.query.userAssets.findMany({
//       where: eq(userAssets.userAccountId, userAccountId),
//     });
//   }

//   // Filter by specific account type
//   return db.query.userAssets.findMany({
//     where: (userAssets, { eq, and }) =>
//       and(
//         eq(userAssets.userAccountId, userAccountId),
//         eq(userAssets.accountType, accountType)
//       ),
//   });
// }

/**
 * Get all milestones for a user with their progress
 */
export async function getAllMilestonesWithProgress(
  config: ProjectionConfigWithDateRange,
  dataSource: ProjectionDataSource
  //db: Database
): Promise<MilestoneProgress[]> {
  // const userMilestones = await db.query.milestones.findMany({
  //   where: eq(milestones.userAccountId, userAccountId),
  // });

  const userMilestones = await dataSource.getMilestones();

  const progressResults: MilestoneProgress[] = [];

  for (const milestone of userMilestones) {
    try {
      //Create milestone target from database record
      const milestoneTarget: MilestoneTarget = {
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        targetValue: milestone.targetValue,
        targetDate: config.endDate, // Use projection end date as target
        accountType: milestone.accountType,
      };

      const progress = await checkMilestoneProgress(
        milestoneTarget,
        config,
        dataSource
      );
      progressResults.push(progress);
    } catch (error) {
      console.error(`Failed to check milestone ${milestone.id}:`, error);
    }
  }

  return progressResults;
}
