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
import { recommendContributionAdjustment } from "./projection-milestone-tracker";
import Decimal from "decimal.js";
import { createDecimalValueString } from "@shared/schema/utils";
import {
  addDateRengeToProjectionConfig,
  calculateYearsAheadOrBehind,
  convertToAgeBasedProjection,
  mapAssetsToContributors,
} from "./projection-utils";
import { createRRulePattern } from "./scheduling";

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

  //console.log("projectionResult : ", projectionResult);

  // Get projected value at retirement
  const projectedValueAtRetirement = projectionResult.totalProjectedValue;

  if (projectedValueAtRetirement === createDecimalValueString("0")) {
    warnings.push(`Projected value at retirement is zero.
This is probably due to having no contributors.
This will cause the projection to be infinite years ahead of retirement.`);
  }

  // Check if on track
  const isOnTrack = Decimal(projectedValueAtRetirement).gte(fireNumber);
  const shortfall = Decimal(fireNumber)
    .sub(projectedValueAtRetirement)
    .toNumber();

  // Calculate years until retirement
  const currentAge = calculateAge(fireConfig.dateOfBirth);

  const yearsAheadOrBehind = calculateYearsAheadOrBehind(
    shortfall,
    fireConfig.targetRetirementAge,
    currentAge,
    projectedValueAtRetirement
  );

  if (yearsAheadOrBehind === Infinity) {
    warnings.push(
      "Projected retirement age is not achievable with the current settings."
    );
  }

  // Calculate monthly shortfall if behind
  let monthlyShortfall: DecimalValueString | undefined;
  if (!isOnTrack) {
    const monthsRemaining = (fireConfig.targetRetirementAge - currentAge) * 12;
    const currentMonthlyContribution = Decimal(
      projectionResult.totalContributions
    )
      .div(monthsRemaining)
      .toNumber();

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

  const fireProjection = convertToAgeBasedProjection(
    projectionResult.timePoints,
    fireConfig.dateOfBirth,
    createDecimalValueString(fireNumber.toString())
  );

  return {
    fireNumber,
    projectedRetirementDate,
    projectedRetirementAge,
    targetRetirementAge: fireConfig.targetRetirementAge,
    projectedValueAtRetirement,
    isOnTrack,
    yearsAheadOrBehind,
    monthlyShortfall,
    fireProjection,
    projectionResult,
    warnings,
  };
}

//type FireProjectionResult = FIREProjectionResult & {};

// export async function projectFire(
//   projectionConfig: Omit<ProjectionConfig, "startDate" | "endDate">,
//   //db: Database
//   dataSource: ProjectionDataSource
// ): Promise<FireProjectionResult> {
//   // Get user's FIRE settings
//   // const userFireSettings = await db.query.fireSettings.findFirst({
//   //   where: eq(fireSettings.userAccountId, userAccountId),
//   // });

//   const userFireSettings = await dataSource.getFireSettings();

//   if (!userFireSettings) {
//     throw new Error("FIRE settings not found for user");
//   }

//   // Get user's date of birth

//   const userProfile = await dataSource.getUserProfile();

//   // const user = await db.query.userAccounts.findFirst({
//   //   where: eq(userAccounts.id, userAccountId),
//   //   with: {
//   //     userProfile: true,
//   //   },
//   // });

//   if (!userProfile?.dob) {
//     throw new Error("User date of birth not found");
//   }

//   // Create FIRE config from settings
//   const fireConfig: FIREProjectionConfig = {
//     dateOfBirth: userProfile.dob,
//     targetRetirementAge: userFireSettings.targetRetirementAge,
//     annualIncomeGoal: userFireSettings.annualIncomeGoal,
//     safeWithdrawalRate: Decimal(userFireSettings.safeWithdrawalRate).toNumber(),
//     adjustForInflation: userFireSettings.adjustInflation,
//     statePensionAge: userFireSettings.statePensionAge,
//   };

//   const retirementProjection = await projectToRetirement(
//     fireConfig,
//     projectionConfig,
//     dataSource
//   );
// }

/**
 * Check FIRE feasibility using user's saved fire settings
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

  //return projectToRetirement(fireConfig, projectionConfig, dataSource);

  //const contributors: Contributor[] = [];

  return projectToRetirement(fireConfig, projectionConfig, contributors);
}

/**
 * Calculate monthly contribution needed to achieve FIRE by target age
 */
export function calculateMonthlyShortfallToFIRE(
  currentPortfolioValue: number,
  fireNumber: number,
  yearsUntilRetirement: number,
  annualGrowthRate: number
): DecimalValueString {
  const monthsRemaining = yearsUntilRetirement * 12;
  const shortfall = fireNumber - currentPortfolioValue;

  if (shortfall <= 0) {
    return createDecimalValueString("0"); // Already at or above FIRE number
  }

  return recommendContributionAdjustment(
    0, // No current contribution
    shortfall,
    monthsRemaining,
    annualGrowthRate
  );
}
