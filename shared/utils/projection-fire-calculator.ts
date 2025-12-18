import {
  FIREProjectionConfig,
  FireProjection,
  ProjectionConfig,
  SimpleProjectionConfig,
  ProjectionConfigWithDateRange,
  ProjectionDataSource,
  Contributor,
} from "@shared/schema/projections";
import { Database } from "@server/db";
import {
  DecimalValueString,
  fireSettings,
  userAccounts,
} from "@server/db/schema";
import { eq } from "drizzle-orm";
import {
  orchestrateProjection,
  projectPortfolio,
} from "./projection-orchestrator";
import { differenceInYears, addYears } from "date-fns";
import Decimal from "decimal.js";
import { createDecimalValueString } from "@shared/schema/utils";
import {
  addDateRengeToProjectionConfig,
  calculateYearsAheadOrBehind,
  convertToAgeBasedProjection,
  mapAssetsToContributors,
  calculateMonthlyContributionDifference,
} from "./projection-utils";
import { createRRulePattern } from "./scheduling";
import { calculateWithdrawalStrategy } from "./projection-withdrawal";

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
  return Decimal(annualIncomeGoal)
    .div(Decimal(safeWithdrawalRate).div(100))
    .toNumber();
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
  fireConfig: FIREProjectionConfig,
  projectionConfig: ProjectionConfig,
  contributors: Contributor[]
  //db: Database
  //dataSource: ProjectionDataSource
): Promise<FireProjection> {
  const warnings: string[] = [];

  // Calculate retirement date
  const retirementDate = calculateRetirementDate(
    fireConfig.dateOfBirth,
    fireConfig.targetRetirementAge
  );

  // Calculate FIRE number
  const fireNumber = calculateFIRENumber(
    Decimal(fireConfig.annualIncomeGoal).toNumber(),
    fireConfig.safeWithdrawalRate
  );

  // Create projection config with retirement date as end date
  //There should not be a cast here
  const fullProjectionConfig: ProjectionConfigWithDateRange =
    addDateRengeToProjectionConfig(
      projectionConfig as ProjectionConfig,
      new Date(),
      retirementDate
    );
  // const fullProjectionConfig: ProjectionConfigWithDateRange = {
  //   ...projectionConfig,
  //   startDate: new Date(),
  //   endDate: retirementDate,
  // } as ProjectionConfigWithDateRange;

  // const projectionResult = await projectPortfolio(
  //   //userAccountId,
  //   fullProjectionConfig,
  //   dataSource,
  //   contributors
  // );

  // Run portfolio projection
  const projectionResult = await orchestrateProjection({
    contributors,
    config: fullProjectionConfig,
    dateOfBirth: fireConfig.dateOfBirth,
    //dataSource,
  });

  // Get projected value at retirement
  const projectedValueAtRetirement = projectionResult.totalProjectedValue;

  if (projectedValueAtRetirement === createDecimalValueString("0")) {
    warnings.push(`Projected value at retirement is zero.
This is probably due to having no contributors.
This will cause the projection to be infinite years ahead of retirement.`);
  }

  // Check if on track

  const currentPortfolioValue = projectionResult.totalCurrentValue;

  const currentDifference = Decimal(fireNumber)
    .sub(currentPortfolioValue)
    .toNumber();

  // This could be a positive or negative number
  const targetDifference = Decimal(projectedValueAtRetirement)
    .sub(Decimal(fireNumber))
    .toNumber();

  const isOnTrack = targetDifference <= 0;

  // Calculate years until retirement
  const currentAge = calculateAge(fireConfig.dateOfBirth);

  // Get current portfolio value

  // Extract schedules from contributors
  const scheduledContributions = contributors.flatMap((c) => c.schedules);

  // Use growth rate from config
  const growthRate =
    projectionConfig.mode === "simple"
      ? (projectionConfig as SimpleProjectionConfig).growthRate
      : 7; // Default 7% if advanced mode

  // Calculate years ahead or behind using the new implementation
  const yearsAheadOrBehind = calculateYearsAheadOrBehind(
    currentPortfolioValue,
    createDecimalValueString(fireNumber.toString()),
    scheduledContributions,
    growthRate,
    fireConfig.targetRetirementAge,
    currentAge
  );

  if (yearsAheadOrBehind === Infinity) {
    warnings.push(
      "Projected retirement age is not achievable with the current settings."
    );
  }

  const yearsRemainingToTargetAge = fireConfig.targetRetirementAge - currentAge;
  const monthsRemainingToTargetAge = yearsRemainingToTargetAge * 12;

  //Question if we should apply a growth rate to the target difference
  const monthlyContributionDifference = calculateMonthlyContributionDifference(
    contributors,
    targetDifference,
    monthsRemainingToTargetAge,
    growthRate
  );

  // Calculate projected retirement date based on trajectory
  const projectedRetirementDate =
    yearsAheadOrBehind === Infinity
      ? null
      : isOnTrack
      ? retirementDate
      : addYears(retirementDate, Math.abs(yearsAheadOrBehind));

  const projectedRetirementAge =
    projectedRetirementDate === null
      ? null
      : calculateAge(fireConfig.dateOfBirth) +
        differenceInYears(projectedRetirementDate, new Date());

  const yearsRemainingToFireTarget =
    //We ise mius here because if the yearsAheadOrBehind is behind it would be a negative number and we want to show that as a positive number
    yearsRemainingToTargetAge - yearsAheadOrBehind;

  const fireProjection = convertToAgeBasedProjection(
    projectionResult.timePoints,
    fireConfig.dateOfBirth,
    createDecimalValueString(fireNumber.toString())
  );

  // Calculate withdrawal strategy
  const withdrawalStrategy = calculateWithdrawalStrategy(
    contributors,
    fireConfig,
    projectionResult
  );

  // Merge withdrawal strategy warnings with existing warnings
  if (withdrawalStrategy.warnings) {
    warnings.push(...withdrawalStrategy.warnings);
  }

  return {
    fireNumber,
    projectedRetirementDate,
    projectedRetirementAge,
    targetRetirementAge: fireConfig.targetRetirementAge,
    projectedValueAtRetirement,
    isOnTrack,
    yearsAheadOrBehind,
    yearsRemainingToFireTarget,
    monthlyContributionDifference,
    fireProjection,
    projectionResult,
    withdrawalStrategy,
    warnings,
  };
}

/**
 * Check FIRE feasibility using user's saved fire settings
 * This is called by the route checkFIREFeasibility as a consequence of a call the endpoint /api/projections/fire.
 * This in turn calls the projectToRetirement function to project the retirement feasibility the same as the client
 */
export async function projectRetirementWithAccountAssets(
  projectionConfig: ProjectionConfig,
  //db: Database
  dataSource: ProjectionDataSource
): Promise<FireProjection> {
  // Get user's FIRE settings
  // const userFireSettings = await db.query.fireSettings.findFirst({
  //   where: eq(fireSettings.userAccountId, userAccountId),
  // });

  const userFireSettings = await dataSource.getFireSettings();

  if (!userFireSettings) {
    throw new Error("FIRE settings not found for user");
  }

  // Get user's date of birth

  const userProfile = await dataSource.getUserProfile();

  // const user = await db.query.userAccounts.findFirst({
  //   where: eq(userAccounts.id, userAccountId),
  //   with: {
  //     userProfile: true,
  //   },
  // });

  if (!userProfile?.dob) {
    throw new Error("User date of birth not found");
  }

  // Create FIRE config from settings
  const fireConfig: FIREProjectionConfig = {
    dateOfBirth: userProfile.dob,
    targetRetirementAge: userFireSettings.targetRetirementAge,
    annualIncomeGoal: userFireSettings.annualIncomeGoal,
    safeWithdrawalRate: Decimal(userFireSettings.safeWithdrawalRate).toNumber(),
    adjustForInflation: userFireSettings.adjustInflation,
    statePensionAge: userFireSettings.statePensionAge,
  };

  const assets = await dataSource.getAssets();

  const contributors = mapAssetsToContributors(assets);

  //If fire settings or other config has "include government pensions" set to true, then add the government pension to the contributors
  //We need to find all the details for the specifics of UK state pension withdrawels etc and rules
  //if (userFireSettings.includeGovernmentPensions) {
  if (true) {
    contributors.push({
      name: "State Pension",
      type: "state_pension",
      currentValue: createDecimalValueString("0"),
      accountType: "SIPP",
      expectedGrowthRate: 0,
      schedules: [
        {
          patternConfig: {
            type: "rrule",
            expression: createRRulePattern(
              "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
            ).expression,
          },
          startDate: calculateRetirementDate(
            fireConfig.dateOfBirth,
            userFireSettings.statePensionAge
          ),
          endDate: null,
          value: createDecimalValueString("0"),
        },
      ],
    });
  }

  //This is the ame method call as the client makes for projecting a portfolio
  return projectToRetirement(fireConfig, projectionConfig, contributors);
}
