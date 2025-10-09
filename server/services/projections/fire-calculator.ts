import {
  FIREProjectionConfig,
  FIREProgress,
  ProjectionConfig,
  SimpleProjectionConfig,
} from "@shared/schema/projections";
import { Database } from "@server/db";
import { fireSettings, userAccounts } from "@server/db/schema";
import { eq } from "drizzle-orm";
import { projectPortfolio } from "./orchestrator";
import { differenceInYears, addYears } from "date-fns";
import { recommendContributionAdjustment } from "./milestone-tracker";

// ============================================================================
// FIRE PROJECTION CALCULATOR
// ============================================================================

/**
 * Calculate retirement date from user's DOB and target retirement age
 */
export function calculateRetirementDate(
  dateOfBirth: Date,
  targetRetirementAge: number
): Date {
  return addYears(dateOfBirth, targetRetirementAge);
}

/**
 * Calculate FIRE number (required portfolio value to retire)
 * Formula: FIRE Number = Annual Income / (Safe Withdrawal Rate / 100)
 */
export function calculateFIRENumber(
  annualIncomeGoal: number,
  safeWithdrawalRate: number
): number {
  return annualIncomeGoal / (safeWithdrawalRate / 100);
}

/**
 * Calculate current age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  return differenceInYears(new Date(), dateOfBirth);
}

/**
 * Project retirement feasibility for a user
 */
export async function projectToRetirement(
  userAccountId: string,
  fireConfig: FIREProjectionConfig,
  projectionConfig: Omit<ProjectionConfig, "startDate" | "endDate">,
  db: Database
): Promise<FIREProgress> {
  // Calculate retirement date
  const retirementDate = calculateRetirementDate(
    fireConfig.dateOfBirth,
    fireConfig.targetRetirementAge
  );

  // Calculate FIRE number
  const fireNumber = calculateFIRENumber(
    fireConfig.annualIncomeGoal,
    fireConfig.safeWithdrawalRate
  );

  // Create projection config with retirement date as end date
  const fullProjectionConfig: ProjectionConfig = {
    ...projectionConfig,
    startDate: new Date(),
    endDate: retirementDate,
  } as ProjectionConfig;

  // Run portfolio projection
  const projectionResult = await projectPortfolio(
    userAccountId,
    fullProjectionConfig,
    db
  );

  // Get projected value at retirement
  const projectedValueAtRetirement = projectionResult.totalProjectedValue;

  // Check if on track
  const isOnTrack = projectedValueAtRetirement >= fireNumber;
  const shortfall = fireNumber - projectedValueAtRetirement;

  // Calculate years until retirement
  const currentAge = calculateAge(fireConfig.dateOfBirth);
  const yearsAheadOrBehind = isOnTrack
    ? 0 // Calculate actual years if ahead
    : Math.ceil(
        shortfall /
          (projectedValueAtRetirement /
            (fireConfig.targetRetirementAge - currentAge))
      );

  // Calculate monthly shortfall if behind
  let monthlyShortfall: number | undefined;
  if (!isOnTrack) {
    const monthsRemaining = (fireConfig.targetRetirementAge - currentAge) * 12;
    const currentMonthlyContribution =
      projectionResult.totalContributions / monthsRemaining;

    // Use growth rate from config
    const growthRate =
      projectionConfig.mode === "simple"
        ? (projectionConfig as SimpleProjectionConfig).growthRate
        : 7; // Default 7% if advanced mode

    monthlyShortfall = recommendContributionAdjustment(
      currentMonthlyContribution,
      shortfall,
      monthsRemaining,
      growthRate
    );
  }

  // Calculate projected retirement date based on trajectory
  const projectedRetirementDate = isOnTrack
    ? retirementDate
    : addYears(retirementDate, Math.abs(yearsAheadOrBehind));

  const projectedRetirementAge =
    calculateAge(fireConfig.dateOfBirth) +
    differenceInYears(projectedRetirementDate, new Date());

  return {
    fireNumber,
    projectedRetirementDate,
    projectedRetirementAge,
    targetRetirementAge: fireConfig.targetRetirementAge,
    projectedValueAtRetirement,
    isOnTrack,
    yearsAheadOrBehind,
    monthlyShortfall,
  };
}

/**
 * Check FIRE feasibility using user's saved fire settings
 */
export async function checkFIREFeasibility(
  userAccountId: string,
  projectionConfig: Omit<ProjectionConfig, "startDate" | "endDate">,
  db: Database
): Promise<FIREProgress> {
  // Get user's FIRE settings
  const userFireSettings = await db.query.fireSettings.findFirst({
    where: eq(fireSettings.userAccountId, userAccountId),
  });

  if (!userFireSettings) {
    throw new Error("FIRE settings not found for user");
  }

  // Get user's date of birth
  const user = await db.query.userAccounts.findFirst({
    where: eq(userAccounts.id, userAccountId),
    with: {
      userProfile: true,
    },
  });

  if (!user?.userProfile?.dob) {
    throw new Error("User date of birth not found");
  }

  // Create FIRE config from settings
  const fireConfig: FIREProjectionConfig = {
    dateOfBirth: user.userProfile.dob,
    targetRetirementAge: userFireSettings.targetRetirementAge,
    annualIncomeGoal: Number(userFireSettings.annualIncomeGoal),
    safeWithdrawalRate: Number(userFireSettings.safeWithdrawalRate),
    adjustForInflation: userFireSettings.adjustInflation,
    statePensionAge: userFireSettings.statePensionAge,
  };

  return projectToRetirement(userAccountId, fireConfig, projectionConfig, db);
}

/**
 * Calculate monthly contribution needed to achieve FIRE by target age
 */
export function calculateMonthlyShortfallToFIRE(
  currentPortfolioValue: number,
  fireNumber: number,
  yearsUntilRetirement: number,
  annualGrowthRate: number
): number {
  const monthsRemaining = yearsUntilRetirement * 12;
  const shortfall = fireNumber - currentPortfolioValue;

  if (shortfall <= 0) {
    return 0; // Already at or above FIRE number
  }

  return recommendContributionAdjustment(
    0, // No current contribution
    shortfall,
    monthsRemaining,
    annualGrowthRate
  );
}
