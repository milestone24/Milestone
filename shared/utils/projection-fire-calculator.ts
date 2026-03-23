import {
  FIREProjectionConfig,
  FireProjection,
  ProjectionConfig,
  SimpleProjectionConfig,
  ProjectionConfigWithDateRange,
  ProjectionConfigWithStartDate,
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
  calculateMonthlyContributionDifference,
  defineStatePensionDetailsUK,
  calculateYearsToTarget,
} from "./projection-utils";
import { attachProjectedReachDates } from "./projection-model-path";
import {
  defineStatePensionContributor,
  mapAssetsToContributors,
} from "./projection-utils-contributor";
import { createRRulePattern } from "./scheduling";
import { calculateWithdrawalStrategy } from "./projection-withdrawal";
import {
  createModifierChain,
  getModifiersAsGlobalList,
} from "./projection-modifiers";

const MAX_BACKFILL_INTERVALS_BY_INTERVAL: Record<
  ProjectionConfig["interval"],
  number
> = {
  daily: 730,
  weekly: 104,
  monthly: 24,
  yearly: 2,
};

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
): DecimalValueString {
  return createDecimalValueString(Decimal(annualIncomeGoal)
    .div(Decimal(safeWithdrawalRate).div(100))
    .toNumber().toString());
}

/**
 * Calculate current age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  return differenceInYears(new Date(), dateOfBirth);
}

/**
 * Project retirement feasibility for a user.
 *
 * Contract:
 * - Accepts either `ProjectionConfig` (no dates) or `ProjectionConfigWithStartDate` (start date only).
 * - `endDate` is never accepted from input here; it is always derived as retirement date.
 *
 * Date semantics:
 * - `startDate` is the "as-of" date for this projection run.
 * - The first rendered/grid point can still be earlier than `startDate` when calendar alignment + backfill
 *   are enabled in downstream projection logic.
 *
 * Flow:
 * 1) Compute retirement date from DOB + target age.
 * 2) Resolve start date from config (or default to now).
 * 3) Build full projection date range via addDateRengeToProjectionConfig(startDate, retirementDate).
 * 4) Run orchestrated projection from contributors.
 * 5) Derive FIRE metrics (progress, years ahead/behind, retirement date estimate, withdrawal strategy).
 */
export async function projectToRetirement(
  fireConfig: FIREProjectionConfig,
  projectionConfig: ProjectionConfig | ProjectionConfigWithStartDate,
  contributors: Contributor[]
  //db: Database
  //dataSource: ProjectionDataSource
): Promise<FireProjection> {
  const warnings: string[] = [];

  const retirementDate = calculateRetirementDate(
    fireConfig.dateOfBirth,
    fireConfig.targetRetirementAge
  );

  const fireNumber = calculateFIRENumber(
    Decimal(fireConfig.annualIncomeGoal).toNumber(),
    Decimal(fireConfig.safeWithdrawalRate).toNumber()
  );

  const startDate =
    "startDate" in projectionConfig && projectionConfig.startDate != null
      ? projectionConfig.startDate
      : new Date();
  const baseConfig: ProjectionConfig =
    "startDate" in projectionConfig
      ? (() => {
          const { startDate: _sd, ...rest } = projectionConfig;
          return rest as ProjectionConfig;
        })()
      : projectionConfig;
  const fullProjectionConfig: ProjectionConfigWithDateRange =
    addDateRengeToProjectionConfig(baseConfig, startDate, retirementDate);

  // Run portfolio projection
  let projectionResult = await orchestrateProjection({
    contributors,
    config: fullProjectionConfig,
    dateOfBirth: fireConfig.dateOfBirth,
    //dataSource,
  });

  if (projectionResult.timePoints.some((p) => p.modelPathValue != null)) {
    projectionResult = {
      ...projectionResult,
      timePoints: attachProjectedReachDates(
        projectionResult.timePoints,
        fireNumber,
      ),
    };
  }

  // Get projected value at retirement
  const projectedValueAtRetirement = projectionResult.totalProjectedValue;

  if (projectedValueAtRetirement === createDecimalValueString("0")) {
    warnings.push(`Projected value at retirement is zero.
This is probably due to having no contributors.
This will cause the projection to be infinite years ahead of retirement.`);
  }

  // Check if on track

  const currentPortfolioValue = projectionResult.totalCurrentValue;

  // This could be a positive or negative number
  const targetDifference = Decimal(fireNumber)
    .sub(Decimal(projectedValueAtRetirement))
    .toNumber();

  const progressPercentage = createDecimalValueString(Decimal(currentPortfolioValue)
    .div(Decimal(fireNumber)).toFixed(2).toString());

  const isOnTrack = targetDifference <= 0;

  // Calculate years until retirement
  const currentAge = calculateAge(fireConfig.dateOfBirth);

  // Extract contributors for projection
  const contributorsForProjection = contributors
    .filter((c) => c.includeContributions)

  // Use growth rate from config
  const growthRate =
    projectionConfig.mode === "simple"
      ? (projectionConfig as SimpleProjectionConfig).growthRate
      : 7; // Default 7% if advanced mode

  const modifierChain = createModifierChain(
    getModifiersAsGlobalList(projectionConfig.modifiers)
  );

  const yearsToTarget = calculateYearsToTarget(
    currentPortfolioValue,
    contributorsForProjection,
    growthRate,
    fireNumber,
    modifierChain,
    {
      startDate: new Date(),
      maxYears: 100,
    }
  );

  // Calculate years ahead or behind using the new implementation
  const yearsAheadOrBehind = calculateYearsAheadOrBehind(
    yearsToTarget,
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
  const monthlyContributionDifference = await calculateMonthlyContributionDifference(
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

  const fireProjectionByAge = convertToAgeBasedProjection(
    projectionResult.timePoints,
    fireConfig.dateOfBirth,
    createDecimalValueString(fireNumber.toString())
  );

  // Calculate withdrawal strategy
  const withdrawalStrategy = calculateWithdrawalStrategy(
    contributorsForProjection,
    fireConfig,
    projectionResult,
    fireConfig.incomeGoals
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
    progressPercentage,
    yearsRemainingToFireTarget: yearsToTarget,
    monthlyContributionDifference,
    fireProjectionByTime: projectionResult.timePoints,
    fireProjectionByAge,
    projectionResult,
    withdrawalStrategy,
    warnings,
  };
}

/**
 * Check FIRE feasibility using user's saved fire settings
 * This is called by the route checkFIREFeasibility as a consequence of a call the endpoint /api/projections/fire.
 *
 * Server-only responsibility:
 * - Reads server data source (fire settings, user profile, assets).
 * - Prepares contributors payload used by shared projection logic.
 * - Calls `projectToRetirement` which is DB-agnostic and can run in client context too.
 *
 * Backfill/history responsibility in this layer:
 * - Uses `getAssetsWithHistory` to obtain asset shape + bounded historical slot data.
 * - Keeps `getAssets` untouched for other callers/flows.
 */
export async function projectRetirementWithContributors(
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
  if (!userProfile?.gender) {
    throw new Error("User date of birth not found");
  }

  // Create FIRE config from settings
  const fireConfig: FIREProjectionConfig = {
    dateOfBirth: userProfile.dob,
    targetRetirementAge: userFireSettings.targetRetirementAge,
    annualIncomeGoal: userFireSettings.annualIncomeGoal,
    safeWithdrawalRate: userFireSettings.safeWithdrawalRate,
    adjustForInflation: userFireSettings.adjustInflation,
    includeStatePension: userFireSettings.includeStatePension,
    incomeGoals: userFireSettings.incomeGoals,
  };

  // Fetch current assets plus bounded historical slots used by calendar backfill.
  const assets = await dataSource.getAssetsWithHistory({
    interval: projectionConfig.interval,
    maxIntervals:
      MAX_BACKFILL_INTERVALS_BY_INTERVAL[projectionConfig.interval],
  });

  let contributors: Contributor[] = mapAssetsToContributors(assets, true, projectionConfig.usePortfolioRecurringContributions);

  /*
  We always push the fire settings montyl contriution
  but we only include the value if the user has not selected to include the portfolio recurring contributions
  */
  contributors.push(
    {
      id: crypto.randomUUID(),
      name: "Fire Settings Monthly Contribution",
      type: "fire-setting",
      accountType: "OTHER",
      currentValue: createDecimalValueString("0"),
      schedules: [{
        startDate: new Date(),
        endDate: null,
        value: createDecimalValueString(userFireSettings.monthlyInvestment),
        patternConfig: {
          type: "rrule",
          expression: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1")
            .expression,
        },
      }],
      includeValue: !projectionConfig.usePortfolioRecurringContributions,
      includeContributions: !projectionConfig.usePortfolioRecurringContributions,
    },
  )

  //If fire settings or other config has "include government pensions" set to true, then add the government pension to the contributors
  //We need to find all the details for the specifics of UK state pension withdrawels etc and rules
  //if (userFireSettings.includeGovernmentPensions) {

  if (fireConfig.includeStatePension) {
    const statePensionContributor = defineStatePensionContributor({
      dateOfBirth: fireConfig.dateOfBirth,
      //gender: fireConfig.gender,
    }, true, true);

    contributors.push(statePensionContributor);
  }

  //This is the ame method call as the client makes for projecting a portfolio
  return projectToRetirement(fireConfig, projectionConfig, contributors);
}
