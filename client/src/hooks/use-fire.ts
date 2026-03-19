import { useSession } from "@/context/SessionContext";
import { calculateAge, defineStatePensionAgeForGenderUK } from "@shared/utils/projection-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";
import { useCreateFireSettings } from "./use-fire-settings-create";
import { usePatchFireSettings } from "./use-fire-settings-patch";
import { useFireSettings } from "./use-fire-settings";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FireSettingsFormValues } from "@/components/fire/FireSettingsForm";
import { DEFAULT_TARGET_RETIREMENT_AGE, FireSettingsInsert, fireSettingsOrphanFormSchema, IncomeGoalKey } from "@shared/schema/portfolio-fire";
import type { IncomeGoal } from "@shared/schema/portfolio-fire";
import { createDecimalValueString } from "@shared/schema/utils";
import { Contributor, FireProjection, FIREProjectionConfig, ProjectionConfig, ProjectionModifier, SimpleProjectionConfig } from "@shared/schema";
import Decimal from "decimal.js";
import { ContributionPreviewState, DEFAULT_PREVIEW_INFLATION_RATE, PreviewModifiersState, useFirePreviewState } from "./use-fire-preview-state";
import { useFirePreferences } from "./use-fire-preferences";
import { useStandaloneContributors } from "./use-standalone-contributors";
import { useFirePreviewProjection, UseFirePreviewProjectionParams } from "./use-fire-preview-projection";
import { useToast } from "./use-toast";
import { fireProjection as fireProjectionQueryKey } from "@shared/api/queryKeys";
import { useFIREProjection } from "./use-projections";
import { DecimalValueString } from "@server/db/schema";
import { createRRulePattern } from "@shared/utils/scheduling";
import { defineContributorRulesForAssetType } from "@shared/utils/projection-utils-contributor";

const growthRatePresets = [
  {
    id: "pessimistic",
    rate: 5,
    label: "Pessimistic (5%)"
  }, {
    id: "base",
    rate: 8,
    label: "Base (8%)"
  }, {
    id: "optimistic",
    rate: 10,
    label: "Optimistic (10%)"
  }
] as const;

export type GrowthRateScenario = (typeof growthRatePresets)[number]
  | {
    id: "custom";
    rate: number;
    label: "Custom";
  }

const hasAt75IncomeGoal = (incomeGoals: IncomeGoal[]): boolean => {
  return incomeGoals.some((incomeGoal) => incomeGoal.key === "reduced_spending_at_75");
};

type UserStatus = {
  status: "satisfied",
  message: undefined;
  dob: Date;
  statePensionAge: number;
  currentAge: number;
} | {
  status: "unsatisfied",
  dob: undefined;
  statePensionAge: undefined;
  currentAge: undefined;
  message: string;
}

type ContributionBreakdown = { accountType: string; amount: number }[];

export type FireAccountSummary = {
  id: string;
  providerName: string;
  accountType: string;
  platformInitial: string;
  monthlyContribution: number;
  lockLabel: string;
  contributionsToDate: number;
  projectedValueAtRetirement: number;
};

type FireChartConfig = {
  currentAmount: number;
  //monthlyInvestment: number;
  expectedReturn: number;
  targetAmount: number;
  currentAge: number;
};

const buildLockLabel = (contributor: Contributor): string => {
  const releases = contributor.valueReleases;
  if (!releases || releases.length === 0) {
    return "Accessible now";
  }

  const ageRelease = releases.find((release) => release.valueType === "age");
  if (ageRelease) {
    const age = Number(ageRelease.value);
    if (Number.isFinite(age)) {
      return `Locked until ${age}`;
    }
  }

  return "Locked until release conditions";
};

const buildFireAccountSummaries = (
  activeProjection: FireProjection | undefined,
  projectionContributors: Contributor[],
): FireAccountSummary[] => {
  if (!activeProjection) return [];

  const breakdown = activeProjection.projectionResult.contributorBreakdown;
  if (!breakdown || breakdown.length === 0) return [];

  const contributorsByRefId = new Map<string, Contributor>();
  for (const contributor of projectionContributors) {
    if (contributor.referenceId) {
      contributorsByRefId.set(contributor.referenceId, contributor);
    }
  }

  const summaries: FireAccountSummary[] = [];

  for (const contributorProjection of breakdown) {
    const matchingContributor =
      contributorProjection.contributorReferenceId &&
      contributorsByRefId.get(contributorProjection.contributorReferenceId);

    if (!matchingContributor) continue;
    if (matchingContributor.type !== "asset") continue;

    const platformName =
      contributorProjection.platformName?.trim() ||
      matchingContributor.platformName?.trim() ||
      "";
    const accountType = contributorProjection.accountType ?? "OTHER";

    const platformInitial =
      (platformName && platformName.charAt(0).toUpperCase()) ||
      (accountType.trim().charAt(0).toUpperCase() || "?");

    const monthlyContribution = matchingContributor.schedules.reduce(
      (sum, schedule) => {
        const numeric = Number(schedule.value ?? 0);
        return sum + (Number.isFinite(numeric) ? numeric : 0);
      },
      0,
    );

    const contributionsToDate = (() => {
      if (!contributorProjection.timePoints.length) {
        return 0;
      }

      // DEV NOTE:
      // This is a placeholder definition of "contributions to date".
      //
      // At the moment, projection time points store contributions as the
      // cumulative user contributions from the projection start date
      // forward, not true historical contributions paid into the account.
      //
      // There are two better long‑term options we need to choose between:
      // 1) Extend the server projection payload to include actual
      //    historical contributions per asset/account.
      // 2) Derive an approximation from schedules using
      //    calculatePeriodContributions over a historical window
      //    (e.g. from each schedule.startDate to "today"), with the
      //    trade‑off that this is only an estimate.
      //
      // Until that decision is made, we approximate by reading the
      // cumulative contributions value from the earliest time point
      // in the contributor series.
      const sorted = [...contributorProjection.timePoints].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const earliest = sorted[0];
      if (!earliest) return 0;

      const numeric = Number(earliest.contributions ?? 0);
      return Number.isFinite(numeric) ? numeric : 0;
    })();

    const projectedValueAtRetirement = Decimal(
      contributorProjection.projectedEndValue,
    ).toNumber();

    const lockLabel = buildLockLabel(matchingContributor);

    summaries.push({
      id: matchingContributor.id,
      providerName: platformName
        ? `${platformName} ${accountType}`
        : `${accountType}`,
      accountType,
      platformInitial,
      monthlyContribution,
      lockLabel,
      contributionsToDate,
      projectedValueAtRetirement,
    });
  }

  return summaries.sort(
    (a, b) => b.projectedValueAtRetirement - a.projectedValueAtRetirement,
  );
};

type UseFireProjectionReturn = {
  error: Error
  userStatus: undefined;
  fireSettingsAvailable: false,
  includePortfolioRecurringContributions: undefined,
  setIncludePortfolioRecurringContributions: undefined,
  fireSettingsForm: undefined,
  handleSaveSettings: undefined,
  isSubmittingFireSettings: false,
  projectionContributors: Contributor[]
  isLoading: false,
  isLoadingFireSettings: false,
  isLoadingProjection: false,
  activeProjection: undefined,
  toggleChart: () => void,
  showChart: false,
  fireChartConfig: undefined,
  setPreviewState: undefined,
  resetPreviewState: undefined,
  contributionBreakdown: undefined,
  addAdjustmentContributor: undefined,
  updateAdjustmentContributor: undefined,
  removeAdjustmentContributor: undefined,
  resetAdjustmentContributors: undefined,
  adjustmentMonthlyAmount: undefined,

  adjustmentsState: undefined,
  setAdjustmentsState: undefined,
  resetAdjustmentsState: undefined,

  growthRateScenario: GrowthRateScenario,
  setGrowthRateScenario: undefined,
  resetGrowthRateScenario: undefined,

  accountTypeOffsets: Map<string, number>,
  setAccountTypeOffset: undefined,
  resetAccountTypeOffsets: undefined,
  baselineProjection: undefined,
  accountsSummary: FireAccountSummary[],

} | {
  error: undefined;
  userStatus: UserStatus;
  fireSettingsAvailable: boolean;
  includePortfolioRecurringContributions: boolean;
  setIncludePortfolioRecurringContributions: (include: boolean) => void;
  fireSettingsForm: UseFormReturn<FireSettingsFormValues>;
  handleSaveSettings: () => void;
  isSubmittingFireSettings: boolean;
  projectionContributors: Contributor[];

  isLoading: boolean;
  isLoadingFireSettings: boolean;
  isLoadingProjection: boolean;

  activeProjection: FireProjection | undefined;

  toggleChart: () => void;
  showChart: boolean;
  fireChartConfig: FireChartConfig;
  setPreviewState: ReturnType<typeof useFirePreviewState>["setPreviewState"];
  resetPreviewState: ReturnType<typeof useFirePreviewState>["resetPreviewState"];

  contributionBreakdown: ContributionBreakdown;

  addAdjustmentContributor: ReturnType<typeof useStandaloneContributors>["addContributor"];
  updateAdjustmentContributor: ReturnType<typeof useStandaloneContributors>["updateContributor"];
  removeAdjustmentContributor: ReturnType<typeof useStandaloneContributors>["removeContributor"];
  resetAdjustmentContributors: ReturnType<typeof useStandaloneContributors>["resetContributors"];
  adjustmentMonthlyAmount: ReturnType<typeof useStandaloneContributors>["totalMonthlyAmount"];

  adjustmentsState: PreviewModifiersState;
  setAdjustmentsState: ReturnType<typeof useFirePreviewState>["setPreviewState"];
  resetAdjustmentsState: ReturnType<typeof useFirePreviewState>["resetPreviewState"];

  growthRateScenario: GrowthRateScenario;
  setGrowthRateScenario: (growthRateScenario: GrowthRateScenario) => void;
  resetGrowthRateScenario: () => void;

  accountTypeOffsets: Map<string, number>;
  setAccountTypeOffset: (accountType: string, delta: number) => void;
  resetAccountTypeOffsets: () => void;
  baselineProjection: FireProjection | undefined;
  accountsSummary: FireAccountSummary[];

}

const returnErrorState = (error: Error): UseFireProjectionReturn => ({
  error,
  userStatus: undefined,
  fireSettingsAvailable: false,
  includePortfolioRecurringContributions: undefined,
  setIncludePortfolioRecurringContributions: undefined,
  fireSettingsForm: undefined,
  handleSaveSettings: undefined,
  isSubmittingFireSettings: false,
  projectionContributors: [],
  isLoading: false,
  isLoadingFireSettings: false,
  isLoadingProjection: false,
  activeProjection: undefined,
  toggleChart: () => { },
  showChart: false,
  fireChartConfig: undefined,
  setPreviewState: undefined,
  resetPreviewState: undefined,

  contributionBreakdown: undefined,

  addAdjustmentContributor: undefined,
  updateAdjustmentContributor: undefined,
  removeAdjustmentContributor: undefined,
  resetAdjustmentContributors: undefined,
  adjustmentMonthlyAmount: undefined,

  adjustmentsState: undefined,
  setAdjustmentsState: undefined,
  resetAdjustmentsState: undefined,

  growthRateScenario: {
    id: "base",
    rate: 8,
    label: "Base (8%)",
  },
  setGrowthRateScenario: undefined,
  resetGrowthRateScenario: undefined,

  accountTypeOffsets: new Map(),
  setAccountTypeOffset: undefined,
  resetAccountTypeOffsets: undefined,
  baselineProjection: undefined,
  accountsSummary: [],
})

const decimalStringToNumber = (decimalString: DecimalValueString | undefined, fallback: number): number => {
  return decimalString ? Decimal(decimalString).toNumber() : fallback;
}

const baseIncomeGoals = (retirementAge: number, annualIncomeGoal: DecimalValueString, reducedSpendingAt75: boolean): IncomeGoal[] => {
  const safeIncomeGoal = annualIncomeGoal || createDecimalValueString("0");
  return [
    {
      key: "retirement_start",
      fromAge: retirementAge,
      incomeGoal: safeIncomeGoal,
    },
    ...(reducedSpendingAt75
      ? [
        {
          key: "reduced_spending_at_75" as IncomeGoalKey,
          fromAge: 75,
          incomeGoal: createDecimalValueString(Decimal.mul(safeIncomeGoal, 0.75).toString()),
        },
      ]
      : []),
  ];
}

export const useFireProjection = (): UseFireProjectionReturn => {

  const [includePortfolioRecurringContributions, setIncludePortfolioRecurringContributions] = useState(true);
  //TODO, complete visualisation of adjusment mode.
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);

  const [accountTypeOffsets, setAccountTypeOffsetsMap] = useState<Map<string, number>>(new Map());
  const accountTypeOffsetIdsRef = useRef<Map<string, string>>(new Map());
  const offsetsStartDate = useMemo(() => new Date(), []);

  const setAccountTypeOffset = useCallback((accountType: string, delta: number) => {
    setAccountTypeOffsetsMap((prev) => {
      const next = new Map(prev);
      if (delta === 0) {
        next.delete(accountType);
      } else {
        next.set(accountType, delta);
      }
      return next;
    });
  }, []);

  const resetAccountTypeOffsets = useCallback(() => {
    setAccountTypeOffsetsMap(new Map());
  }, []);

  const debouncedAccountTypeOffsets = useDebouncedValue(accountTypeOffsets, 250);

  const { user } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userDOB = user?.profile?.dob;
  const currentAge = userDOB ? calculateAge(userDOB) : NaN;

  const statePensionAge =
    userDOB
      ? defineStatePensionAgeForGenderUK(userDOB)
      : NaN;

  const userStatus: UserStatus = useMemo(() => {
    if (!userDOB) {
      return {
        status: "unsatisfied",
        message: "User date of birth and gender are required",
        dob: undefined,
        statePensionAge: undefined,
        currentAge: undefined,
      };
    }
    return {
      status: "satisfied",
      message: undefined,
      dob: userDOB,
      statePensionAge: statePensionAge,
      currentAge: currentAge,
    };
  }, [userDOB]);

  const { data: fireSettings, isLoading: isLoadingFireSettings, isFetched, error: fireSettingsError } =
    useFireSettings();

  const fireSettingsAvailable = isFetched && !!fireSettings;
  const { mutateAsync: updateFireSettings } = usePatchFireSettings();
  const { mutateAsync: createFireSettings } = useCreateFireSettings();

  // Single form instance for the entire page
  const fireSettingsForm = useForm<FireSettingsFormValues>({
    mode: "all",
    resolver: zodResolver(fireSettingsOrphanFormSchema),
    values: fireSettings
      ? {
        annualIncomeGoal: fireSettings?.annualIncomeGoal ?? "0",
        //expectedAnnualReturn: fireSettings?.expectedAnnualReturn ?? "7",
        safeWithdrawalRate: fireSettings?.safeWithdrawalRate ?? "4",
        //monthlyInvestment: fireSettings?.monthlyInvestment ?? "",
        targetRetirementAge:
          fireSettings?.targetRetirementAge ?? DEFAULT_TARGET_RETIREMENT_AGE,
        adjustInflation: fireSettings?.adjustInflation ?? true,
        includeStatePension: fireSettings?.includeStatePension ?? false,
        reduceSpendingAt75: hasAt75IncomeGoal(
          fireSettings?.incomeGoals ?? []
        ),
      }
      : undefined,
    defaultValues: {
      annualIncomeGoal: "0",
      //expectedAnnualReturn: "7",
      safeWithdrawalRate: "4",
      //monthlyInvestment: "0",
      targetRetirementAge: DEFAULT_TARGET_RETIREMENT_AGE,
      adjustInflation: true,
      includeStatePension: false,
      reduceSpendingAt75: false,
    },
  });

  const {
    formState: { isSubmitting: isSubmittingFireSettings },
    handleSubmit,
    watch,
  } = fireSettingsForm;

  const {
    //monthlyInvestment,
    targetRetirementAge,
    annualIncomeGoal,
    safeWithdrawalRate,
    adjustInflation,
    includeStatePension,
    reduceSpendingAt75,
    //expectedAnnualReturn
  } = watch()

  const firePreviewConfig = useMemo<FIREProjectionConfig | null>(() => {
    if (!userDOB) return null;
    if (!annualIncomeGoal || !safeWithdrawalRate) return null;

    //Here we should should be be goig from Decimal string to number back to Decimal string.
    //Always use createDecimalValueString to create the Decimal string.
    return {
      dateOfBirth: userDOB,
      targetRetirementAge,
      annualIncomeGoal,
      safeWithdrawalRate,
      adjustForInflation: adjustInflation,
      includeStatePension: includeStatePension,
      incomeGoals: baseIncomeGoals(targetRetirementAge, annualIncomeGoal, reduceSpendingAt75),
    } satisfies FIREProjectionConfig;
  }, [
    userDOB,
    targetRetirementAge,
    annualIncomeGoal,
    safeWithdrawalRate,
    adjustInflation,
    includeStatePension,
    reduceSpendingAt75,
    statePensionAge,
  ]);

  const lastValidFirePreviewConfigRef = useRef<FIREProjectionConfig | null>(null);
  if (firePreviewConfig !== null) {
    lastValidFirePreviewConfigRef.current = firePreviewConfig;
  }

  const baseModifiers = useMemo(() => {
    if (!adjustInflation) {
      return [];
    }

    return [
      {
        type: "inflation" as const,
        enabled: true,
        rate: DEFAULT_PREVIEW_INFLATION_RATE,
        description: "Inflation",
      },
    ];
  }, [adjustInflation]);

  const modifiers = useMemo<ProjectionModifier[]>(
    () => baseModifiers,
    [baseModifiers]
  );

  //Growth mode should be currently disabled until next phase of application.
  //const { growthMode, setGrowthMode, growthScenario, setGrowthScenario, showChart, toggleChart } =
  const { growthRateScenario, setGrowthRateScenario, showChart, toggleChart } =
    useFirePreferences();

  const resetGrowthRateScenario = useCallback(() => setGrowthRateScenario({
    id: "base",
    rate: 8,
    label: "Base (8%)",
  }), []);

  const projectionConfig = useMemo<
    Omit<SimpleProjectionConfig, "startDate" | "endDate">
  >(
    () => ({
      mode: "simple",
      growthRate: 8,
      growthModel: "linear",
      interval: "monthly",
      modifiers,
      usePortfolioRecurringContributions: includePortfolioRecurringContributions,
      useContributorSpecificGrowthRates: false,
      seriesAlignment: "calendar",
      backfillIntervals: 1,
    }),
    [modifiers, includePortfolioRecurringContributions]
  );

  const {
    data: currentProjection,
    isLoading: isLoadingProjection,
    error: projectionError,
    refetch,
  } = useFIREProjection(
    projectionConfig
  );

  const {
    previewState,
    setPreviewState,
    setInflation,
    previewModifiers,
    resetPreviewState,
  } = useFirePreviewState();

  const setContributionPreviewState = useCallback(
    (state: ContributionPreviewState) => {
      setPreviewState((prev) => ({
        ...prev,
        contribution: state,
      }));
    },
    [setPreviewState]
  );

  const resetContributionPreviewState = useCallback(() => {
    resetPreviewState();
  }, [resetPreviewState]);

  const {
    contributors: adjustmentContributors,
    addContributor: addAdjustmentContributor,
    updateContributor: updateAdjustmentContributor,
    removeContributor: removeAdjustmentContributor,
    resetContributors: resetAdjustmentContributors,
    //mappedContributors: mappedAdjustmentContributors,
    totalMonthlyAmount: adjustmentMonthlyAmount,
    hasCustomContributors: hasAdjustmentCustomContributors,
  } = useStandaloneContributors();

  const hasAdjustmentContributors = useMemo(() => {
    return adjustmentContributors.length > 0;
  }, [adjustmentContributors]);

  const accountTypeOffsetContributors: Contributor[] = useMemo(() => {
    return Array.from(debouncedAccountTypeOffsets.entries())
      .filter(([, delta]) => delta !== 0)
      .map(([accType, delta]) => {
        if (!accountTypeOffsetIdsRef.current.has(accType)) {
          accountTypeOffsetIdsRef.current.set(accType, crypto.randomUUID());
        }
        const id = accountTypeOffsetIdsRef.current.get(accType)!;
        return {
          id,
          name: `${accType} Slider Adjustment`,
          type: "adjustment" as const,
          accountType: accType as Parameters<typeof defineContributorRulesForAssetType>[0],
          currentValue: createDecimalValueString("0"),
          schedules: [
            {
              patternConfig: createRRulePattern("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"),
              value: createDecimalValueString(delta.toString()),
              startDate: offsetsStartDate,
              endDate: null,
            },
          ],
          includeValue: false,
          includeContributions: true,
          ...defineContributorRulesForAssetType(accType as Parameters<typeof defineContributorRulesForAssetType>[0]),
        };
      });
  }, [debouncedAccountTypeOffsets, offsetsStartDate]);

  const previewModifiersActive =
    previewState.contribution.scaleFactor !== 1 ||
    previewState.contribution.enabled === false ||
    previewState.inflation.enabled !== adjustInflation ||
    Math.abs(previewState.inflation.rate - DEFAULT_PREVIEW_INFLATION_RATE) >
    0.01;

  const previewEnabled = previewModifiersActive
    || hasAdjustmentContributors
    || growthRateScenario.rate !== 8
    || accountTypeOffsets.size > 0
  //Growth mode is currently disabled until next phase of application.
  //|| growthMode === "contributor";

  const previewProjectionConfig = useMemo<ProjectionConfig | null>(() => {
    if (!projectionConfig) {
      return null;
    }

    return {
      ...projectionConfig,
      growthRate: growthRateScenario.rate,
      modifiers: previewState.contribution.enabled
        ? previewModifiers
        : previewModifiers.filter(
          (modifier) => modifier.type !== "contribution_scaler"
        ),
      //Growth mode is currently disabled until next phase of application.
      //useContributorSpecificGrowthRates: growthMode === "contributor",
      useContributorSpecificGrowthRates: false,
    } satisfies ProjectionConfig;
  }, [projectionConfig, previewModifiers, previewState.contribution.enabled, growthRateScenario]);

  const projectionContributors: Contributor[] = useMemo(() => {
    //Add contributors from initial server state
    //Add contributors from standalone contributors
    return [
      ...currentProjection?.projectionResult.computationContext?.contributors ?? [],
      ...adjustmentContributors,
      ...accountTypeOffsetContributors,
    ];
  }, [currentProjection, adjustmentContributors, accountTypeOffsetContributors]);

  const previewParams: UseFirePreviewProjectionParams = useMemo(() => ({
    baseProjection: currentProjection,
    fireConfig: lastValidFirePreviewConfigRef.current ?? undefined,
    projectionConfig: previewProjectionConfig,
    contributors: projectionContributors,
    enabled: previewEnabled,
  }), [currentProjection, firePreviewConfig, previewProjectionConfig, projectionContributors, previewEnabled]);


  const { projection: previewProjection } = useFirePreviewProjection(previewParams);

  const previewActive = !!previewProjection;

  const activeProjection: FireProjection | undefined = previewActive
    ? previewProjection
    : currentProjection;

  const fireChartConfig: FireChartConfig = useMemo(
    () => ({
      currentAmount: decimalStringToNumber(activeProjection?.projectionResult.totalCurrentValue, 0),
      //Temporarily satisfy the type whilst we remove monthlyInvestment from the settings.
      //monthlyInvestment: decimalStringToNumber(monthlyInvestment, 0),
      //Temporarily satisfy the type whilst we remove expectedAnnualReturn from the settings.
      //expectedReturn: decimalStringToNumber(expectedAnnualReturn, 0),
      expectedReturn: 7,
      targetAmount: decimalStringToNumber(activeProjection?.fireNumber, 0),
      currentAge: currentAge,
    }),
    [
      currentAge,
      activeProjection,
      //monthlyInvestment,
      //expectedAnnualReturn,
    ]
  );

  const contributionTotals = new Map<string, number>();
  projectionContributors.forEach((contributor) => {
    const total = contributor.schedules.reduce((sum, schedule) => {
      const numeric = Number(schedule.value ?? 0);
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
    if (total > 0) {
      contributionTotals.set(
        contributor.accountType ?? "Unspecified",
        (contributionTotals.get(contributor.accountType ?? "Unspecified") ??
          0) + total
      );
    }
  });

  const contributionBreakdown = Array.from(contributionTotals.entries()).map(
    ([accountType, amount]) => ({
      accountType,
      amount,
    })
  );

  contributionBreakdown.sort((a, b) => b.amount - a.amount);

  const handleSaveSettings = fireSettingsForm.handleSubmit(async (data) => {
    const settings: Omit<FireSettingsInsert, "id" | "userAccountId"> = {
      ...data,
      incomeGoals: baseIncomeGoals(data.targetRetirementAge, data.annualIncomeGoal, data.reduceSpendingAt75),
    };

    try {
      if (!fireSettings) {
        await createFireSettings(settings);
      } else {
        await updateFireSettings(settings);
      }
      fireSettingsForm.reset(data);
      //setIsSettingsEditorOpen(false);
      toast({
        title: "Settings saved",
        description: "Your FIRE settings have been saved successfully.",
      });
      await queryClient.invalidateQueries({ queryKey: fireProjectionQueryKey });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const fireError = useMemo(() => fireSettingsError ?? projectionError, [fireSettingsError, projectionError]);

  //Question this
  const isLoading = isLoadingFireSettings || isLoadingProjection;

  const accountsSummary = useMemo(
    () => buildFireAccountSummaries(activeProjection, projectionContributors),
    [activeProjection, projectionContributors],
  );

  return fireError
    ? returnErrorState(fireError)
    : {
      error: undefined,
      userStatus,
      fireSettingsAvailable,
      includePortfolioRecurringContributions,
      setIncludePortfolioRecurringContributions,

      fireSettingsForm,
      handleSaveSettings,
      isSubmittingFireSettings,

      projectionContributors,

      isLoading,
      isLoadingFireSettings,
      isLoadingProjection,

      activeProjection,

      toggleChart,
      showChart,

      fireChartConfig,

      setPreviewState,
      resetPreviewState,

      contributionBreakdown,

      addAdjustmentContributor,
      updateAdjustmentContributor,
      removeAdjustmentContributor,
      resetAdjustmentContributors,
      adjustmentMonthlyAmount,

      adjustmentsState: previewState,
      setAdjustmentsState: setPreviewState,
      resetAdjustmentsState: resetPreviewState,

      growthRateScenario,
      setGrowthRateScenario,
      resetGrowthRateScenario,

      accountTypeOffsets,
      setAccountTypeOffset,
      resetAccountTypeOffsets,
      baselineProjection: currentProjection,
      accountsSummary,
    }


};