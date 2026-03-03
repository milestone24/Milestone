import { useSession } from "@/context/SessionContext";
import { calculateAge, defineStatePensionAgeForGenderUK } from "@shared/utils/projection-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
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

type FireChartConfig = {
  currentAmount: number;
  //monthlyInvestment: number;
  expectedReturn: number;
  targetAmount: number;
  currentAge: number;
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

  scenarioGrowthRate: null,
  setScenarioGrowthRate: undefined,
  resetScenarioGrowthRate: undefined,

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

  scenarioGrowthRate: number | null;
  setScenarioGrowthRate: (rate: number | null) => void;
  resetScenarioGrowthRate: () => void;

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

  scenarioGrowthRate: null,
  setScenarioGrowthRate: undefined,
  resetScenarioGrowthRate: undefined,
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

  const [includePortfolioRecurringContributions, setIncludePortfolioRecurringContributions] = useState(false);
  //TODO, complete visualisation of adjusment mode.
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
  const [scenarioGrowthRate, setScenarioGrowthRate] = useState<number | null>(null);

  const resetScenarioGrowthRate = useCallback(() => setScenarioGrowthRate(null), []);

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

  const { growthMode, setGrowthMode, showChart, toggleChart } =
    useFirePreferences();

  const projectionConfig = useMemo<
    Omit<SimpleProjectionConfig, "startDate" | "endDate">
  >(
    () => ({
      mode: "simple",
      //TODO make growth rate a decimal value string
      //Temporarily satisfy the type whilst we remove expectedAnnualReturn from the settings.
      //growthRate: Decimal(expectedAnnualReturn).toNumber(),
      growthRate: 7,
      growthModel: "linear",
      interval: "yearly",
      modifiers,
      usePortfolioRecurringContributions: includePortfolioRecurringContributions,
      useContributorSpecificGrowthRates: growthMode === "contributor",
    }),
    //Temporarily satisfy the type whilst we remove expectedAnnualReturn from the settings.
    //[growthMode, modifiers, expectedAnnualReturn, includePortfolioRecurringContributions]
    [growthMode, modifiers, includePortfolioRecurringContributions]
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


  const previewModifiersActive =
    previewState.contribution.scaleFactor !== 1 ||
    previewState.contribution.enabled === false ||
    previewState.inflation.enabled !== adjustInflation ||
    Math.abs(previewState.inflation.rate - DEFAULT_PREVIEW_INFLATION_RATE) >
    0.01;

  const previewEnabled = previewModifiersActive || hasAdjustmentContributors || scenarioGrowthRate !== null;

  const previewProjectionConfig = useMemo<ProjectionConfig | null>(() => {
    if (!projectionConfig) {
      return null;
    }

    return {
      ...projectionConfig,
      ...(scenarioGrowthRate !== null ? { growthRate: scenarioGrowthRate } : {}),
      modifiers: previewState.contribution.enabled
        ? previewModifiers
        : previewModifiers.filter(
          (modifier) => modifier.type !== "contribution_scaler"
        ),
    } as ProjectionConfig;
  }, [projectionConfig, previewModifiers, previewState.contribution.enabled, scenarioGrowthRate]);

  const projectionContributors: Contributor[] = useMemo(() => {
    //Add contributors from initial server state
    //Add contributors from standalone contributors
    return [
      ...currentProjection?.projectionResult.computationContext?.contributors ?? [],
      ...adjustmentContributors
    ];
  }, [currentProjection, adjustmentContributors]);

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

      scenarioGrowthRate,
      setScenarioGrowthRate,
      resetScenarioGrowthRate,
    }


};