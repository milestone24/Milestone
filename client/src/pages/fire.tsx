import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_STATE_PENSION_AGE,
  DEFAULT_TARGET_RETIREMENT_AGE,
  FireSettingsInsert,
  fireSettingsInsertSchema,
  fireSettingsOrphanSchema,
  createDecimalValueString,
} from "@shared/schema";
import type {
  FIREProjectionConfig,
  ProjectionConfig,
} from "@shared/schema/projections";
import { useSession } from "@/hooks/use-session";
import { calculateAge } from "@shared/utils/projection-utils";
import { useFireSettings } from "@/hooks/use-fire-settings";
import { usePatchFireSettings } from "@/hooks/use-fire-settings-patch";
import { useCreateFireSettings } from "@/hooks/use-fire-settings-create";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { FireSummarySection } from "@/components/fire/FireSummarySection";
import { FireGrowthModeToggleCard } from "@/components/fire/FireGrowthModeToggleCard";
import { FireProjectionChartCard } from "@/components/fire/FireProjectionChartCard";
import { FireSettingsPanel } from "@/components/fire/FireSettingsPanel";
import { FireSettingsSummaryCard } from "@/components/fire/FireSettingsSummaryCard";
import { FireInflationCard } from "@/components/fire/FireInflationCard";
import { StandaloneContributorsPanel } from "@/components/fire/StandaloneContributorsPanel";
import { useFirePreferences } from "@/hooks/use-fire-preferences";
import {
  ContributionPreviewState,
  DEFAULT_PREVIEW_INFLATION_RATE,
  DEFAULT_PREVIEW_STATE,
  InflationPreviewState,
  useFirePreviewState,
} from "@/hooks/use-fire-preview-state";
import { useFireProjectionState } from "@/hooks/use-fire-projection-state";
import { useFirePreviewProjection } from "@/hooks/use-fire-preview-projection";
import { FirePageSkeleton } from "@/components/fire/FirePageSkeleton";
import { FirePageError } from "@/components/fire/FirePageError";
import { useStandaloneContributors } from "@/hooks/use-standalone-contributors";
import { useQueryClient } from "@tanstack/react-query";
import { fireProjection } from "@shared/api/queryKeys";
import { FireOverviewCard } from "@/components/fire/FireOverviewCard";
import { FireContributionsCard } from "@/components/fire/FireContributionsCard";
import Decimal from "decimal.js";

// Calculate UK State Pension age based on date of birth
const calculateStatePensionAge = (
  dob: string | Date | null | undefined
): number => {
  if (!dob) return DEFAULT_STATE_PENSION_AGE;

  const dobDate = typeof dob === "string" ? new Date(dob) : dob;
  const cutoffDate = new Date("1960-04-06");

  // Born before April 6, 1960 → 66, otherwise → 67
  return dobDate < cutoffDate ? 66 : 67;
};

export default function Fire() {
  const { toast } = useToast();

  const { user } = useSession();
  const currentAge = user?.profile?.dob ? calculateAge(user.profile.dob) : NaN;
  const statePensionAge = calculateStatePensionAge(user?.profile?.dob);
  //const { data: portfolioOverview } = usePortfolioOverview();
  const queryClient = useQueryClient();

  //console.log("portfolioOverview", portfolioOverview);

  const { data: fireSettings, isLoading: isLoadingFireSettings } =
    useFireSettings();
  const { mutateAsync: updateFireSettings } = usePatchFireSettings();
  const { mutateAsync: createFireSettings } = useCreateFireSettings();

  // Single form instance for the entire page
  const fireSettingsForm = useForm<FireSettingsInsert>({
    resolver: zodResolver(fireSettingsOrphanSchema),
    defaultValues: {
      annualIncomeGoal: "",
      expectedAnnualReturn: "7",
      safeWithdrawalRate: "4",
      monthlyInvestment: "",
      targetRetirementAge: DEFAULT_TARGET_RETIREMENT_AGE,
      statePensionAge: statePensionAge,
      adjustInflation: true,
    },
  });

  const {
    formState: { isSubmitting: isSubmittingFireSettings },
    handleSubmit,
  } = fireSettingsForm;

  // Watch values for calculations
  const fireSettingsValues = fireSettingsForm.watch();

  // Helper variables for numeric conversions (used in calculations and display)
  // These convert DecimalValueString form values to numbers where needed
  const monthlyInvestment = Number(fireSettingsValues.monthlyInvestment || 0);
  const expectedReturn = Number(fireSettingsValues.expectedAnnualReturn || 0);
  const withdrawalRate = Number(fireSettingsValues.safeWithdrawalRate || 0);
  const annualIncomeGoal = Number(fireSettingsValues.annualIncomeGoal || 0);
  const targetRetirementAge = Number(
    fireSettingsValues.targetRetirementAge || DEFAULT_TARGET_RETIREMENT_AGE
  );
  const adjustInflation = fireSettingsValues.adjustInflation ?? true;

  const firePreviewConfig = useMemo<FIREProjectionConfig | null>(() => {
    if (!user?.profile?.dob) return null;

    const dob =
      typeof user.profile.dob === "string"
        ? new Date(user.profile.dob)
        : user.profile.dob;

    if (!dob || Number.isNaN(dob.getTime())) {
      return null;
    }

    return {
      dateOfBirth: dob,
      targetRetirementAge,
      annualIncomeGoal: createDecimalValueString(
        (fireSettingsValues.annualIncomeGoal || "0").toString()
      ),
      safeWithdrawalRate: withdrawalRate,
      adjustForInflation: adjustInflation,
      statePensionAge,
    } satisfies FIREProjectionConfig;
  }, [
    user?.profile?.dob,
    targetRetirementAge,
    fireSettingsValues.annualIncomeGoal,
    withdrawalRate,
    adjustInflation,
    statePensionAge,
  ]);

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

  const { growthMode, setGrowthMode, showChart, toggleChart } =
    useFirePreferences();

  const {
    previewState,
    setPreviewState,
    setInflation,
    previewModifiers,
    resetPreviewState,
  } = useFirePreviewState();

  const {
    mode: contributionMode,
    setMode: setContributionMode,
    contributors: standaloneContributors,
    addContributor,
    updateContributor,
    removeContributor,
    resetContributors,
    mappedContributors,
    totalMonthlyAmount: standaloneMonthlyAmount,
    hasCustomContributors,
  } = useStandaloneContributors();

  const [isSettingsEditorOpen, setIsSettingsEditorOpen] = useState(false);

  const handleOpenPreviewModifiers = useCallback(() => {
    const anchor =
      typeof document !== "undefined"
        ? document.getElementById("preview-modifiers")
        : null;
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Update form when fireSettings loads
  useEffect(() => {
    if (fireSettings) {
      fireSettingsForm.reset({
        ...fireSettings,
        // Money fields: strip trailing zeros for cleaner display
        annualIncomeGoal: parseFloat(fireSettings.annualIncomeGoal).toString(),
        monthlyInvestment: parseFloat(
          fireSettings.monthlyInvestment
        ).toString(),
        // Percentage fields: retain 2 decimal places
        expectedAnnualReturn: parseFloat(
          fireSettings.expectedAnnualReturn
        ).toFixed(2),
        safeWithdrawalRate: parseFloat(fireSettings.safeWithdrawalRate).toFixed(
          2
        ),
        statePensionAge: statePensionAge, // Always use calculated value based on DOB
      });
    }
  }, [fireSettings, fireSettingsForm, statePensionAge]);

  useEffect(() => {
    if (!adjustInflation && previewState.inflation.enabled) {
      setInflation((prev) => ({
        ...prev,
        enabled: false,
      }));
    }
  }, [adjustInflation, previewState.inflation.enabled, setInflation]);

  const {
    projectionConfig,
    fireProjectionData,
    currentProjection,
    isLoading,
    error,
    refetch,
    yearsToFire,
    yearsRemainingToFireTarget,
    contributorsForFire,
    currentPortfolioValue,
    fireChartConfig,
    projectedRetirementAge,
    monthlyContributionDifference,
    fireNumber,
  } = useFireProjectionState({
    expectedReturn,
    baseModifiers,
    growthMode,
    monthlyInvestment,
    currentAge,
    userDob: user?.profile?.dob,
    portfolioFallbackValue: 0, //Number(portfolioOverview?.value ?? 0),
  });

  const isUsingCustomContributors =
    contributionMode === "custom" && mappedContributors.length > 0;

  const previewContributors = isUsingCustomContributors
    ? mappedContributors
    : contributorsForFire;

  const previewModifiersActive =
    previewState.contribution.scaleFactor !== 1 ||
    previewState.contribution.enabled === false ||
    previewState.inflation.enabled !== adjustInflation ||
    Math.abs(previewState.inflation.rate - DEFAULT_PREVIEW_INFLATION_RATE) >
      0.01;

  const previewEnabled = previewModifiersActive || isUsingCustomContributors;

  const previewProjectionConfig = useMemo<ProjectionConfig | null>(() => {
    if (!projectionConfig) {
      return null;
    }

    return {
      ...projectionConfig,
      modifiers: previewState.contribution.enabled
        ? previewModifiers
        : previewModifiers.filter(
            (modifier) => modifier.type !== "contribution_scaler"
          ),
    } as ProjectionConfig;
  }, [projectionConfig, previewModifiers, previewState.contribution.enabled]);

  const { projection: previewProjection } = useFirePreviewProjection({
    baseProjection: currentProjection,
    fireConfig: firePreviewConfig ?? undefined,
    projectionConfig: previewProjectionConfig,
    contributors: previewContributors,
    enabled: previewEnabled,
  });

  const previewActive = !!previewProjection;

  const activeProjection = previewActive
    ? previewProjection
    : currentProjection;

  const activeFireProjectionData = previewActive
    ? previewProjection!.fireProjection
    : fireProjectionData;

  const activeFireNumber = activeProjection?.fireNumber ?? fireNumber;

  //TODO
  //TODO
  const activeYearsToFire = Math.abs(23); //activeProjection?.yearsRemainingToFireTarget
  //? Math.abs(activeProjection.yearsRemainingToFireTarget)
  //: yearsRemainingToFireTarget;

  const activeProjectedRetirementAge = activeProjection?.projectedRetirementAge
    ? Math.round(activeProjection.projectedRetirementAge)
    : projectedRetirementAge;
  const activeMonthlyContributionDifference = previewActive
    ? previewProjection?.monthlyContributionDifference
      ? createDecimalValueString(
          previewProjection.monthlyContributionDifference
        )
      : null
    : monthlyContributionDifference;

  const activeCurrentPortfolioValue = previewActive
    ? Number(
        previewProjection?.projectionResult.totalCurrentValue ??
          currentPortfolioValue
      )
    : currentPortfolioValue;

  const activeFireChartConfig = useMemo(() => {
    if (!previewActive) {
      return fireChartConfig;
    }

    return {
      ...fireChartConfig,
      currentAmount: activeCurrentPortfolioValue,
      targetAmount: activeFireNumber,
    };
  }, [
    activeCurrentPortfolioValue,
    activeFireNumber,
    fireChartConfig,
    previewActive,
  ]);

  const activeCurrentProjectedPortfolioValueDecimal =
    activeProjection?.projectedValueAtRetirement
      ? createDecimalValueString(activeProjection.projectedValueAtRetirement)
      : null;

  const summaryData = useMemo(() => {
    const retirementPoint =
      activeProjectedRetirementAge === null
        ? undefined
        : activeFireProjectionData.find(
            (point) => point.age >= activeProjectedRetirementAge
          ) ?? activeFireProjectionData[activeFireProjectionData.length - 1];

    const firstAccessiblePoint = activeFireProjectionData.find(
      (point) => point.accessibleValue && Number(point.accessibleValue) > 0
    );

    const accessibleValueAtRetirement = retirementPoint?.accessibleValue
      ? Number(retirementPoint.accessibleValue)
      : undefined;

    const lockedValueAtRetirement = retirementPoint?.lockedValue
      ? Number(retirementPoint.lockedValue)
      : undefined;

    const progressPercentage =
      activeCurrentProjectedPortfolioValueDecimal && activeFireNumber > 0
        ? Decimal(activeCurrentProjectedPortfolioValueDecimal)
            .div(activeFireNumber)
            .mul(10000)
            .round()
            .div(100)
            .toNumber()
        : 0;

    const contributionTotals = new Map<string, number>();
    previewContributors.forEach((contributor) => {
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

    const statePensionIncluded = previewContributors.some(
      (contributor) => contributor.type === "state_pension"
    );

    return {
      accessibleValueAtRetirement,
      lockedValueAtRetirement,
      firstAccessibleAge: firstAccessiblePoint?.age,
      progressPercentage,
      previewActive: previewActive || previewEnabled,
      contributionBreakdown,
      statePensionIncluded,
    };
  }, [
    activeCurrentPortfolioValue,
    activeFireNumber,
    activeFireProjectionData,
    activeProjectedRetirementAge,
    previewContributors,
    previewActive,
    previewEnabled,
  ]);

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

  const setInflationPreviewState = useCallback(
    (state: InflationPreviewState) => {
      setPreviewState((prev) => ({
        ...prev,
        inflation: state,
      }));
    },
    [setPreviewState]
  );

  const resetInflationPreviewState = useCallback(() => {
    resetPreviewState();
  }, [resetPreviewState]);

  // Handle form submission
  const handleSaveSettings = fireSettingsForm.handleSubmit(async (data) => {
    const settings: Omit<FireSettingsInsert, "id" | "userAccountId"> = {
      ...data,
    };

    try {
      if (!fireSettings) {
        await createFireSettings(settings);
      } else {
        await updateFireSettings(settings);
      }
      fireSettingsForm.reset(data);
      setIsSettingsEditorOpen(false);
      toast({
        title: "Settings saved",
        description: "Your FIRE settings have been saved successfully.",
      });
      await queryClient.invalidateQueries({ queryKey: fireProjection });
    } catch (error) {
      console.error("Error saving FIRE settings:", error);
      toast({
        title: "Error saving settings",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  if (!user?.profile?.dob) {
    return (
      <div className="fire-screen mx-auto max-w-5xl px-4 pb-20">
        <Card className="mt-4">
          <CardContent className="p-4">
            <h2 className="mb-3 text-lg font-semibold">FIRE Calculator</h2>
            <p className="mb-6 text-sm text-gray-600">
              You must set your date of birth before you can use the FIRE
              calculator. This should be done in your profile settings.
            </p>
            <Link href="/profile">Go to Profile</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingFireSettings || isLoading) {
    return (
      <div className="fire-screen mx-auto max-w-5xl px-4 pb-20">
        <FirePageSkeleton />
      </div>
    );
  }

  // If no FIRE settings exist, show initial setup
  if (!fireSettings) {
    return (
      <div className="fire-screen mx-auto max-w-5xl px-4 pb-20">
        <Card className="mt-4">
          <CardContent className="p-4">
            <h2 className="mb-3 text-lg font-semibold">
              Welcome to FIRE Planning
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Let's set up your Financial Independence and Retire Early (FIRE)
              goals. This will help you track your progress towards financial
              independence.
            </p>

            <FireSettingsPanel
              form={fireSettingsForm}
              onSubmit={handleSaveSettings}
              isSubmitting={isSubmittingFireSettings}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log("error", error);

  // Main FIRE calculator view
  return (
    <div className="fire-screen mx-auto max-w-5xl px-2 pb-20 md:px-4">
      <div className="flex w-full flex-col space-y-6">
        <div>
          <h2 className="text-lg font-semibold">FIRE Calculator</h2>
          <p className="text-sm text-gray-600">
            Plan your Financial Independence and Retire Early
          </p>
        </div>

        <FireOverviewCard
          //projectedRetirementAge={activeProjectedRetirementAge}
          targetRetirementAge={activeProjection?.targetRetirementAge ?? null}
          valueAtRetirement={
            activeProjection?.projectedValueAtRetirement
              ? Number(activeProjection.projectedValueAtRetirement)
              : 0
          }
          fireNumber={activeFireNumber}
          showChart={showChart}
          onToggleChart={toggleChart}
          currentPortfolioValue={activeCurrentPortfolioValue}
          currentPortfolioValueGrowth={0}
          progressPercentage={summaryData.progressPercentage}
          currentAge={currentAge}
          yearsToFire={
            activeProjection?.yearsRemainingToFireTarget ?? activeYearsToFire
          }
        />
        {showChart ? (
          <FireProjectionChartCard
            showChart={showChart}
            onToggle={toggleChart}
            projectionData={activeFireProjectionData}
            yearsToFire={activeYearsToFire}
            chartConfig={activeFireChartConfig}
            targetRetirementAge={targetRetirementAge}
            projectedRetirementAge={activeProjectedRetirementAge}
          />
        ) : null}

        <FireContributionsCard
          contributionBreakdown={summaryData.contributionBreakdown}
          monthlyContributionDifference={
            activeMonthlyContributionDifference ?? null
          }
          //StandalonePanelProps (Tochange)
          mode={contributionMode}
          onModeChange={setContributionMode}
          contributors={standaloneContributors}
          onAddContributor={addContributor}
          onUpdateContributor={updateContributor}
          onRemoveContributor={removeContributor}
          onReset={resetContributors}
          totalMonthlyAmount={standaloneMonthlyAmount}
          contributionPreviewState={previewState.contribution}
          onChangeContributionPreviewState={setContributionPreviewState}
          onResetContributionPreviewState={resetContributionPreviewState}
        />

        <FireSettingsSummaryCard
          form={fireSettingsForm}
          onSubmit={handleSaveSettings}
          isSubmitting={isSubmittingFireSettings}
          isDirty={fireSettingsForm.formState.isDirty}
          open={isSettingsEditorOpen}
          onOpenChange={setIsSettingsEditorOpen}
          onOpenPreviewModifiers={handleOpenPreviewModifiers}
        />

        {error ? (
          <FirePageError error={error as Error} onRetry={refetch} />
        ) : (
          <FireSummarySection
            currentPortfolioValue={activeCurrentPortfolioValue}
            fireNumber={activeFireNumber}
            annualIncomeGoal={annualIncomeGoal}
            withdrawalRate={withdrawalRate}
            projectedRetirementAge={activeProjectedRetirementAge}
            targetRetirementAge={targetRetirementAge}
            yearsToFire={activeYearsToFire}
            statePensionAge={statePensionAge}
            firstAccessibleAge={summaryData.firstAccessibleAge}
            accessibleValueAtRetirement={
              summaryData.accessibleValueAtRetirement
            }
            lockedValueAtRetirement={summaryData.lockedValueAtRetirement}
            monthlyContributionDifference={
              activeMonthlyContributionDifference ?? undefined
            }
            progressPercentage={summaryData.progressPercentage}
            previewActive={summaryData.previewActive}
            customContributorsActive={isUsingCustomContributors}
            contributionBreakdown={summaryData.contributionBreakdown}
            statePensionIncluded={summaryData.statePensionIncluded}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FireGrowthModeToggleCard
            growthMode={growthMode}
            onChange={setGrowthMode}
          />
          <div id="preview-modifiers">
            <FireInflationCard
              inflationPreviewState={previewState.inflation}
              onChange={setInflationPreviewState}
              onReset={resetPreviewState}
            />
          </div>
        </div>

        {/* <StandaloneContributorsPanel
          mode={contributionMode}
          onModeChange={setContributionMode}
          contributors={standaloneContributors}
          onAddContributor={addContributor}
          onUpdateContributor={updateContributor}
          onRemoveContributor={removeContributor}
          onReset={resetContributors}
          totalMonthlyAmount={standaloneMonthlyAmount}
        /> */}
      </div>
    </div>
  );
}
