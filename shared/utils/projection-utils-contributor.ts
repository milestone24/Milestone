import {
  BonusValue,
  Contributor,
  ContributorRules,
  ContributorSchedule,
  ContributorTax,
  ContributorType,
  createDecimalValueString,
  ProjectionOrchestratorAssetInput,
  RecurringContribution,
  ValueReleasePointInTime,
} from "@shared/schema";
import { defineStatePensionDetailsUK } from "./projection-utils";
import { createRRulePattern } from "./scheduling";

export function mapRecurringContributionToContributorSchedule(
  recurringContribution: RecurringContribution
): ContributorSchedule {
  return {
    patternConfig: recurringContribution.patternConfig,
    value: recurringContribution.amount,
    startDate: recurringContribution.startDate,
    //TODO: Add end date from recurring contribution when we have that functionality
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

export const valueReleasesLISA: ValueReleasePointInTime[] = [
  {
    value: "60", // Age 60 or over
    valueType: "age",
    penalties: [
      {
        rule: {
          comparator: "lt", // Less than age 60
          value: "60",
        },
        penalty: {
          valueType: "percentage",
          value: createDecimalValueString("0.25"), // 25% withdrawal charge
        },
      },
    ],
  },
];

//We have kept this the same as LISA for now, we need to clarify the difference.
export const valueReleasesISA: ValueReleasePointInTime[] = valueReleasesLISA;

/**
 * Self-Invested Personal Pension: Minimum Pension Age 55 (rising to 57 from April 2028)
 * For simplicity, using age 55. Could be enhanced to check date >= 2028-04-06 for age 57
 */
export const valueReleasesSIPP: ValueReleasePointInTime[] = [
  {
    value: "55", // Minimum Pension Age (55, or 57 from April 2028)
    valueType: "age",
    penalties: [
      {
        rule: {
          comparator: "lt", // Less than age 55
          value: "55",
        },
        penalty: {
          valueType: "percentage",
          value: createDecimalValueString("1.0"), // 100% locked (cannot access before minimum age)
        },
      },
    ],
    exceptions: [], // No exceptions for early access to pensions
  },
];

export const valueReleasesCISA: ValueReleasePointInTime[] = [
  {
    value: "18", // Age 18
    valueType: "age",
    //Question these penalties?
    // penalties: [
    //   {
    //     rule: {
    //       comparator: "lt", // Less than age 18
    //       value: "18",
    //     },
    //     penalty: {
    //       valueType: "percentage",
    //       value: createDecimalValueString("1.0"), // 100% locked (cannot access before age 18)
    //     },
    //   },
    // ],
    exceptions: [], // No exceptions for Junior ISA
  },
];

function defineValueReleasePointsForAssetType(
  contributionType: ContributorType
): ValueReleasePointInTime[] {
  switch (contributionType) {
    case "LISA":
      return valueReleasesLISA;
    case "ISA":
      return valueReleasesISA;
    case "SIPP":
      return valueReleasesSIPP;
    case "GIA":
      // Flexible withdrawals - no restrictions
      return [];
    default:
      return [];
  }
}

export const bonusValuesLISA: BonusValue[] = [
  {
    name: "LISA",
    valueType: "percentage",
    value: createDecimalValueString("0.25"), // 25% government bonus
    annualLimit: createDecimalValueString("1000"), // Max bonus: 25% of £4,000 = £1,000
    annualContributionLimit: createDecimalValueString("4000"), // Max contributions eligible for bonus
    priority: 1,
  },
];

//Check this
export const bonusValuesISA: BonusValue[] = bonusValuesLISA;

function defineBonusValuesForAssetType(
  assetType: ContributorType
): BonusValue[] {
  switch (assetType) {
    case "LISA":
      return bonusValuesLISA;
    case "ISA":
      return bonusValuesISA;
    case "SIPP":
    case "GIA":
      // No government bonuses for these account types
      return [];
    default:
      return [];
  }
}

export function defineTaxesForAssetType(
  assetType: ContributorType
): ContributorTax[] {
  switch (assetType) {
    case "LISA":
      return [];
    case "ISA":
      return [];
    default:
      return [];
  }
}

export function defineContributorRulesForLISA(): ContributorRules {
  return {
    valueReleases: defineValueReleasePointsForAssetType("LISA"),
    bonusValues: defineBonusValuesForAssetType("LISA"),
    taxes: defineTaxesForAssetType("LISA"),
    expectedGrowthRate: 7,
  };
}

export function defineContributorRulesForISA(): ContributorRules {
  return {
    valueReleases: defineValueReleasePointsForAssetType("ISA"),
    bonusValues: defineBonusValuesForAssetType("ISA"),
    taxes: defineTaxesForAssetType("ISA"),
    expectedGrowthRate: 7,
  };
}

export function defineContributorRulesForSIPP(): ContributorRules {
  return {
    valueReleases: defineValueReleasePointsForAssetType("SIPP"),
    bonusValues: defineBonusValuesForAssetType("SIPP"),
    taxes: defineTaxesForAssetType("SIPP"),
    expectedGrowthRate: 7,
  };
}

export function defineContributorRulesForGIA(): ContributorRules {
  return {
    valueReleases: defineValueReleasePointsForAssetType("GIA"),
    bonusValues: defineBonusValuesForAssetType("GIA"),
    taxes: defineTaxesForAssetType("GIA"),
    expectedGrowthRate: 7,
  };
}

export function defineContributorRulesForAssetType(
  assetType: ContributorType
): ContributorRules {
  switch (assetType) {
    case "LISA":
      return defineContributorRulesForLISA();
    case "ISA":
      return defineContributorRulesForISA();
    case "SIPP":
      return defineContributorRulesForSIPP();
    case "GIA":
      return defineContributorRulesForGIA();
    default:
      return {
        valueReleases: [],
        bonusValues: [],
        expectedGrowthRate: 0,
        taxes: [],
      };
  }
}

export function mapAssetToContributor(
  asset: ProjectionOrchestratorAssetInput,
  includeValue: boolean,
  includeContributions: boolean
): Contributor {
  return {
    id: crypto.randomUUID(),
    referenceId: asset.id,
    accountType: asset.accountType,
    name: asset.name,
    platformName: asset.platformName,
    type: "asset",
    currentValue: asset.currentValue,
    schedules: mapRecurringContributionsToContributorSchedules(
      asset.recurringContributions
    ),
    ...defineContributorRulesForAssetType(asset.accountType),
    includeValue,
    includeContributions,
  };
}

export function mapAssetsToContributors(
  assets: ProjectionOrchestratorAssetInput[],
  includeValue: boolean,
  includeContributions: boolean
): Contributor[] {
  return assets.map((asset) => mapAssetToContributor(asset, includeValue, includeContributions));
}

export type StatePensionProps = {
  dateOfBirth: Date;
};

export function defineStatePensionContributor(
  props: StatePensionProps,
  includeValue: boolean,
  includeContributions: boolean
): Contributor {
  const { dateOfBirth, } = props;
  const { age, startDate } = defineStatePensionDetailsUK(dateOfBirth);
  return {
    id: crypto.randomUUID(),
    name: "State Pension",
    type: "state_pension",
    currentValue: createDecimalValueString("0"),
    accountType: "PENSION",
    expectedGrowthRate: 0,
    valueReleases: [
      {
        value: age.toString(),
        valueType: "age",
      },
    ],
    schedules: [
      {
        patternConfig: {
          type: "rrule",
          expression: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1")
            .expression,
        },
        startDate: startDate,
        endDate: null,
        value: createDecimalValueString("1000"),
      },
    ],
    includeValue,
    includeContributions,
  };
}
