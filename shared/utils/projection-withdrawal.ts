import {
  Contributor,
  FIREProjectionConfig,
  ProjectionResult,
  ValueReleasePointInTime,
} from "@shared/schema/projections";
import {
  DecimalValueString,
  createDecimalValueString,
} from "@shared/schema/utils";
import { AccountType } from "@shared/schema";
import Decimal from "decimal.js";
import { addYears, differenceInYears } from "date-fns";

// Reuse existing helpers
import { calculateAgeAtDate } from "./projection-value-release";
import { calculatePeriodContributions } from "./projection-utils";

// ============================================================================
// WITHDRAWAL STRATEGY TYPES
// ============================================================================

export interface ContributorUnlockInfo {
  contributor: Contributor;
  unlockAge: number | null;
  unlockDate: Date | null;
  isImmediatelyAccessible: boolean;
  taxCharacteristics: string;
}

export interface WithdrawalAllocation {
  contributorName: string;
  contributorReferenceId?: string;
  accountType: AccountType;
  annualAmount: DecimalValueString;
  taxCharacteristics: string;
}

export interface WithdrawalPhase {
  phaseType: "building" | "withdrawal";
  fromAge: number;
  toAge: number | null;
  annualIncomeTarget: DecimalValueString;
  allocations: WithdrawalAllocation[];
  warnings?: string[];
}

export interface AccountAccessTimelineEntry {
  age: number | null;
  accountType: AccountType;
  contributorName: string;
  contributorReferenceId?: string;
  projectedValue: DecimalValueString;
  taxCharacteristics: string;
  isAccessible: boolean;
}

export interface IncomeGoal {
  fromAge: number;
  incomeGoal: DecimalValueString;
}

export interface WithdrawalStrategy {
  phases: WithdrawalPhase[];
  accountAccessTimeline: AccountAccessTimelineEntry[];
  warnings?: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the earliest unlock age from a contributor's valueReleases
 *
 * NOTE: Similar logic exists in projection-accessible-value.ts (lines 100-123)
 * but implemented here independently to avoid modifying production code.
 */
export function getContributorUnlockAge(
  valueReleases: ValueReleasePointInTime[] | undefined,
  dateOfBirth: Date
): number | null {
  if (!valueReleases || valueReleases.length === 0) {
    return null;
  }

  let earliestUnlockAge: number | null = null;

  for (const releasePoint of valueReleases) {
    let unlockAge: number | null = null;

    if (releasePoint.valueType === "age") {
      const requiredAge = parseInt(releasePoint.value, 10);
      if (!isNaN(requiredAge)) {
        unlockAge = requiredAge;
      }
    } else if (releasePoint.valueType === "date") {
      try {
        const releaseDate = new Date(releasePoint.value);
        if (!isNaN(releaseDate.getTime())) {
          unlockAge = differenceInYears(releaseDate, dateOfBirth);
        }
      } catch {
        // Invalid date, skip
      }
    }

    if (unlockAge !== null) {
      if (earliestUnlockAge === null || unlockAge < earliestUnlockAge) {
        earliestUnlockAge = unlockAge;
      }
    }
  }

  return earliestUnlockAge;
}

/**
 * Derive tax characteristics from contributor properties
 */
export function getTaxCharacteristics(contributor: Contributor): string {
  const { accountType, valueReleases, type } = contributor;

  if (type === "state_pension") {
    return "Taxed as income";
  }

  const hasPenalties = valueReleases?.some(
    (vr) => vr.penalties && vr.penalties.length > 0
  );

  switch (accountType) {
    case "GIA":
      return "Capital gains tax";
    case "ISA":
      return "Tax-free";
    case "LISA":
      return hasPenalties
        ? "Tax-free after 60 (25% penalty if early)"
        : "Tax-free";
    case "SIPP":
      return "25% tax-free lump sum, rest taxed as income";
    case "CISA":
      return "Tax-free (Junior ISA)";
    default:
      return "Standard taxation";
  }
}

export function buildContributorUnlockInfo(
  contributor: Contributor,
  dateOfBirth: Date,
  currentAge: number
): ContributorUnlockInfo {
  const unlockAge = getContributorUnlockAge(
    contributor.valueReleases,
    dateOfBirth
  );

  // Income-stream contributors (state pension) are NEVER immediately accessible
  // They only provide income starting at their release age
  const isIncomeStream = isIncomeStreamContributor(contributor);
  const isImmediatelyAccessible = isIncomeStream
    ? false
    : unlockAge === null || unlockAge <= currentAge;

  let unlockDate: Date | null = null;
  if (unlockAge !== null) {
    unlockDate = new Date(dateOfBirth);
    unlockDate.setFullYear(unlockDate.getFullYear() + unlockAge);
  }

  return {
    contributor,
    unlockAge,
    unlockDate,
    isImmediatelyAccessible,
    taxCharacteristics: getTaxCharacteristics(contributor),
  };
}

export function identifyUnlockEvents(
  contributors: Contributor[],
  dateOfBirth: Date
): number[] {
  const unlockAges = new Set<number>();

  for (const contributor of contributors) {
    const unlockAge = getContributorUnlockAge(
      contributor.valueReleases,
      dateOfBirth
    );
    if (unlockAge !== null) {
      unlockAges.add(unlockAge);
    }
  }

  return Array.from(unlockAges).sort((a, b) => a - b);
}

// ============================================================================
// TIMELINE & PHASE BUILDING
// ============================================================================

/**
 * Calculate annual income from a contributor's schedules.
 * Uses calculatePeriodContributions to correctly handle all schedule patterns/frequencies.
 * Used for income-based contributors like state pension.
 *
 * For schedules with future start dates (e.g., state pension starting at age 66),
 * we calculate based on the schedule's start date to determine the annual income
 * that WILL be received once the schedule becomes active.
 */
export function getAnnualScheduledIncomeForContributor(
  contributor: Contributor
): DecimalValueString {
  if (!contributor.schedules || contributor.schedules.length === 0) {
    return createDecimalValueString("0");
  }

  // Find the earliest schedule start date to use as our projection base
  // This ensures we calculate income for when the schedule is actually active
  const firstSchedule = contributor.schedules[0];
  if (!firstSchedule) {
    return createDecimalValueString("0");
  }

  const earliestStartDate = contributor.schedules.reduce(
    (earliest, schedule) => {
      const scheduleStart = new Date(schedule.startDate);
      // Use getTime() for explicit timestamp comparison
      return scheduleStart.getTime() < earliest.getTime()
        ? scheduleStart
        : earliest;
    },
    new Date(firstSchedule.startDate)
  );

  // Use the schedule's start date as the projection start
  // Add one day to ensure we're past the start date for RRule calculations
  const startDate = new Date(earliestStartDate);
  //startDate.setDate(startDate.getDate() + 1);
  const endDate = addYears(startDate, 1);

  const periodResult = calculatePeriodContributions(
    contributor,
    startDate,
    endDate
  );

  return createDecimalValueString(periodResult.contributions.toString());
}

/**
 * Check if a contributor is an income-stream type (not a withdrawable pot).
 * Income-stream contributors provide scheduled income after release, not a pot to draw from.
 */
function isIncomeStreamContributor(contributor: Contributor): boolean {
  return contributor.type === "state_pension";
}

function getProjectedValueAtAge(
  contributor: Contributor,
  targetAge: number,
  dateOfBirth: Date,
  projectionResult: ProjectionResult
): DecimalValueString {
  // For income-stream contributors (state pension), return annual income
  // The "value" before release is 0; after release it's the scheduled income
  if (isIncomeStreamContributor(contributor)) {
    const unlockAge = getContributorUnlockAge(
      contributor.valueReleases,
      dateOfBirth
    );
    if (unlockAge !== null && targetAge >= unlockAge) {
      return getAnnualScheduledIncomeForContributor(contributor);
    }
    // Before unlock age, value is 0
    return createDecimalValueString("0");
  }

  // For regular assets, find the projected pot value
  const contributorProjection = projectionResult.contributorBreakdown.find(
    (cp) =>
      cp.contributorReferenceId === contributor.referenceId ||
      cp.contributorName === contributor.name
  );

  if (!contributorProjection || contributorProjection.timePoints.length === 0) {
    return contributor.currentValue;
  }

  const targetDate = new Date(dateOfBirth);
  targetDate.setFullYear(targetDate.getFullYear() + targetAge);
  const targetTimestamp = targetDate.getTime();

  const firstPoint = contributorProjection.timePoints[0];
  if (!firstPoint) {
    return contributor.currentValue;
  }

  let closestPoint = firstPoint;
  let closestDiff = Math.abs(closestPoint.date.getTime() - targetTimestamp);

  for (const point of contributorProjection.timePoints) {
    const diff = Math.abs(point.date.getTime() - targetTimestamp);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestPoint = point;
    }
  }

  return closestPoint.value;
}

export function buildAccountAccessTimeline(
  contributors: Contributor[],
  dateOfBirth: Date,
  currentAge: number,
  projectionResult: ProjectionResult
): AccountAccessTimelineEntry[] {
  const timeline: AccountAccessTimelineEntry[] = [];

  for (const contributor of contributors) {
    const unlockInfo = buildContributorUnlockInfo(
      contributor,
      dateOfBirth,
      currentAge
    );

    // For income-stream contributors (state pension), they are NEVER immediately accessible
    // They only provide income after their release age
    const isIncomeStream = isIncomeStreamContributor(contributor);
    const isAccessible = isIncomeStream
      ? false
      : unlockInfo.isImmediatelyAccessible;

    // Display age: the age at which the contributor becomes accessible/active
    const displayAge = isAccessible ? null : unlockInfo.unlockAge;

    // Calculate the value to display:
    // - For income-stream (state pension): show annual income at release age
    // - For regular assets: show projected pot value at release age or current value
    let projectedValue: DecimalValueString;
    if (isIncomeStream) {
      // State pension: show the annual income they'll receive (not 0)
      projectedValue = getAnnualScheduledIncomeForContributor(contributor);
    } else if (displayAge !== null) {
      projectedValue = getProjectedValueAtAge(
        contributor,
        displayAge,
        dateOfBirth,
        projectionResult
      );
    } else {
      projectedValue = contributor.currentValue;
    }

    timeline.push({
      age: displayAge,
      accountType: contributor.accountType as AccountType,
      contributorName: contributor.name,
      contributorReferenceId: contributor.referenceId,
      projectedValue,
      taxCharacteristics: unlockInfo.taxCharacteristics,
      isAccessible,
    });
  }

  return timeline.sort((a, b) => {
    if (a.age === null && b.age === null) return 0;
    if (a.age === null) return -1;
    if (b.age === null) return 1;
    return a.age - b.age;
  });
}

function getTaxEfficiencyPriority(
  accountType: AccountType,
  contributorType: string
): number {
  if (contributorType === "state_pension") return 100;

  switch (accountType) {
    case "GIA":
      return 1;
    case "ISA":
      return 2;
    case "LISA":
      return 3;
    case "SIPP":
      return 4;
    case "CISA":
      return 5;
    default:
      return 50;
  }
}

function calculatePhaseAllocations(
  availableContributors: ContributorUnlockInfo[],
  annualIncomeTarget: DecimalValueString,
  phaseFromAge: number,
  dateOfBirth: Date,
  projectionResult: ProjectionResult
): { allocations: WithdrawalAllocation[]; warnings: string[] } {
  const allocations: WithdrawalAllocation[] = [];
  const warnings: string[] = [];

  const sortedContributors = [...availableContributors].sort((a, b) => {
    const priorityA = getTaxEfficiencyPriority(
      a.contributor.accountType as AccountType,
      a.contributor.type
    );
    const priorityB = getTaxEfficiencyPriority(
      b.contributor.accountType as AccountType,
      b.contributor.type
    );
    return priorityA - priorityB;
  });

  let remainingTarget = Decimal(annualIncomeTarget);

  // Handle income-stream contributors first (e.g., state pension)
  // These provide automatic income after their release age - not a withdrawal from a pot
  for (const unlockInfo of sortedContributors) {
    if (!isIncomeStreamContributor(unlockInfo.contributor)) continue;

    // Double-check: only include if phase is at or after the release age
    const releaseAge = unlockInfo.unlockAge;
    if (releaseAge !== null && phaseFromAge < releaseAge) {
      continue; // Not yet available in this phase
    }

    const annualIncome = getAnnualScheduledIncomeForContributor(
      unlockInfo.contributor
    );

    if (Decimal(annualIncome).gt(0)) {
      allocations.push({
        contributorName: unlockInfo.contributor.name,
        contributorReferenceId: unlockInfo.contributor.referenceId,
        accountType: unlockInfo.contributor.accountType as AccountType,
        annualAmount: annualIncome,
        taxCharacteristics: unlockInfo.taxCharacteristics,
      });
      remainingTarget = remainingTarget.sub(annualIncome);
    }
  }

  // Allocate from withdrawable accounts (pot-based contributors)
  for (const unlockInfo of sortedContributors) {
    if (isIncomeStreamContributor(unlockInfo.contributor)) continue;
    if (remainingTarget.lte(0)) break;

    const projectedValue = getProjectedValueAtAge(
      unlockInfo.contributor,
      phaseFromAge,
      dateOfBirth,
      projectionResult
    );

    const allocation = Decimal.min(
      remainingTarget,
      Decimal(projectedValue).div(10)
    );

    if (allocation.gt(0)) {
      allocations.push({
        contributorName: unlockInfo.contributor.name,
        contributorReferenceId: unlockInfo.contributor.referenceId,
        accountType: unlockInfo.contributor.accountType as AccountType,
        annualAmount: createDecimalValueString(allocation.toString()),
        taxCharacteristics: unlockInfo.taxCharacteristics,
      });
      remainingTarget = remainingTarget.sub(allocation);
    }
  }

  if (remainingTarget.gt(0)) {
    warnings.push(
      `Unable to fully meet income target. Shortfall: £${remainingTarget.toFixed(
        2
      )}/year`
    );
  }

  return { allocations, warnings };
}

export function buildWithdrawalPhases(
  contributors: Contributor[],
  fireConfig: FIREProjectionConfig,
  projectionResult: ProjectionResult,
  incomeGoals: IncomeGoal[]
): WithdrawalPhase[] {
  const phases: WithdrawalPhase[] = [];
  const { dateOfBirth, targetRetirementAge } = fireConfig;
  const currentAge = calculateAgeAtDate(dateOfBirth, new Date());

  const contributorUnlockInfos = contributors.map((c) =>
    buildContributorUnlockInfo(c, dateOfBirth, currentAge)
  );

  // Sort income goals by fromAge ascending
  const sortedIncomeGoals = [...incomeGoals].sort(
    (a, b) => a.fromAge - b.fromAge
  );

  // Collect all phase boundary ages:
  // 1. Contributor unlock ages (when accounts become accessible)
  const unlockAges = identifyUnlockEvents(contributors, dateOfBirth);
  // 2. Income goal change ages
  const incomeGoalAges = sortedIncomeGoals.map((g) => g.fromAge);

  // Combine all boundary ages, filter to after retirement, dedupe, and sort
  const allBoundaryAges = new Set<number>([
    targetRetirementAge,
    ...unlockAges.filter((age) => age >= targetRetirementAge),
    ...incomeGoalAges.filter((age) => age >= targetRetirementAge),
  ]);
  const phaseBoundaries = Array.from(allBoundaryAges).sort((a, b) => a - b);

  // Building phase
  phases.push({
    phaseType: "building",
    fromAge: currentAge,
    toAge: targetRetirementAge,
    annualIncomeTarget: createDecimalValueString("0"),
    allocations: [],
  });

  // Withdrawal phases
  for (let i = 0; i < phaseBoundaries.length; i++) {
    const fromAge = phaseBoundaries[i];
    const toAge = phaseBoundaries[i + 1] ?? null;

    if (fromAge === undefined) {
      continue;
    }

    // Find the applicable income goal for this phase
    // Use the last income goal where fromAge >= goal.fromAge
    let incomeTarget =
      sortedIncomeGoals[0]?.incomeGoal ?? createDecimalValueString("0");
    for (const goal of sortedIncomeGoals) {
      if (fromAge >= goal.fromAge) {
        incomeTarget = goal.incomeGoal;
      }
    }

    const availableContributors = contributorUnlockInfos.filter((info) => {
      if (info.isImmediatelyAccessible) return true;
      return info.unlockAge !== null && fromAge >= info.unlockAge;
    });

    const { allocations, warnings } = calculatePhaseAllocations(
      availableContributors,
      incomeTarget,
      fromAge,
      dateOfBirth,
      projectionResult
    );

    phases.push({
      phaseType: "withdrawal",
      fromAge,
      toAge,
      annualIncomeTarget: incomeTarget,
      allocations,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  return phases;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function calculateWithdrawalStrategy(
  contributors: Contributor[],
  fireConfig: FIREProjectionConfig,
  projectionResult: ProjectionResult,
  incomeGoals: IncomeGoal[]
): WithdrawalStrategy {
  const { dateOfBirth } = fireConfig;
  const currentAge = calculateAgeAtDate(dateOfBirth, new Date());
  const warnings: string[] = [];

  const accountAccessTimeline = buildAccountAccessTimeline(
    contributors,
    dateOfBirth,
    currentAge,
    projectionResult
  );

  const phases = buildWithdrawalPhases(
    contributors,
    fireConfig,
    projectionResult,
    incomeGoals
  );

  if (contributors.length === 0) {
    warnings.push("No contributors found for withdrawal strategy calculation");
  }

  const accessibleNow = accountAccessTimeline.filter((e) => e.isAccessible);
  if (accessibleNow.length === 0) {
    warnings.push("No accounts are immediately accessible");
  }

  return {
    phases,
    accountAccessTimeline,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
