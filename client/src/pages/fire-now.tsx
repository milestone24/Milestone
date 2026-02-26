import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FireProjectionChartCard } from "@/components/fire/FireProjectionChartCard";
import { FireSettingsPanel } from "@/components/fire/FireSettingsPanel";
import { FireSettingsSummaryCard } from "@/components/fire/FireSettingsSummaryCard";
import { ContributionPreviewState } from "@/hooks/use-fire-preview-state";
import { FirePageSkeleton } from "@/components/fire/FirePageSkeleton";
import { FirePageError } from "@/components/fire/FirePageError";
import { FireOverviewCard } from "@/components/fire/FireOverviewCard";
import { FireOverviewStickyBar } from "@/components/fire/FireOverviewStickyBar";
import { WithdrawalStrategyCard } from "@/components/fire/WithdrawalStrategyCard";
import { FireHeroCard } from "@/components/fire/FireHeroCard";
import { useFireProjection } from "@/hooks/use-fire";
import { useElementInView } from "@/hooks/use-element-in-view";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { createDecimalValueString } from "@shared/schema";
import type { FireScenario } from "@/components/fire/FireScenarioSelector";
import Decimal from "decimal.js";

export default function Fire() {
  const {
    userStatus,
    fireSettingsAvailable,
    projectionContributors,
    includePortfolioRecurringContributions,
    setIncludePortfolioRecurringContributions,

    fireSettingsForm,
    handleSaveSettings,

    error,

    isLoadingFireSettings,
    isLoadingProjection,
    isLoading,
    isSubmittingFireSettings,

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

    adjustmentsState,

    scenarioGrowthRate,
    setScenarioGrowthRate,
    resetScenarioGrowthRate,
  } = useFireProjection();

  const [activeScenario, setActiveScenario] = useState<FireScenario | null>(null);

  const handleScenarioSelect = useCallback(
    (scenario: FireScenario, rate: number) => {
      setActiveScenario(scenario);
      setScenarioGrowthRate?.(rate);
    },
    [setScenarioGrowthRate]
  );

  const handleScenarioReset = useCallback(() => {
    setActiveScenario(null);
    resetScenarioGrowthRate?.();
  }, [resetScenarioGrowthRate]);

  //TODO: Why do we need this custom starting value?
  const [customStartingValue, setCustomStartingValue] = useState(0);

  const handleIncludePortfolioRecurringContributionsChange = useCallback(
    (v: boolean) => {
      setIncludePortfolioRecurringContributions?.(v);
    },
    [setIncludePortfolioRecurringContributions],
  );

  const [isSettingsEditorOpen, setIsSettingsEditorOpen] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);
  const overviewInView = useElementInView(overviewRef, {
    enabled: !!activeProjection,
  });

  const setContributionPreviewState = useCallback(
    (state: ContributionPreviewState) => {
      setPreviewState?.((prev) => ({
        ...prev,
        contribution: state,
      }));
    },
    [setPreviewState],
  );

  const resetContributionPreviewState = useCallback(() => {
    resetPreviewState?.();
  }, [resetPreviewState]);

  const handleSaveFireSettings = useCallback(async () => {
    await handleSaveSettings?.();
  }, [handleSaveSettings]);

  if (userStatus?.status === "unsatisfied") {
    return (
      <div className="fire-screen mx-auto max-w-5xl px-4 pb-20">
        <Card className="mt-4">
          <CardContent className="p-4">
            <h2 className="mb-3 text-lg font-semibold">FIRE Calculator</h2>
            <p className="mb-6 text-sm text-gray-600">
              {userStatus.message}
              FIRE calculator. This should be done in your profile settings.
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
  if (!fireSettingsAvailable) {
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
            {fireSettingsForm ? (
              <FireSettingsPanel
                form={fireSettingsForm}
                onSubmit={handleSaveFireSettings}
                isSubmitting={isSubmittingFireSettings}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

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

        {error ? (
          <FirePageError error={error} />
        ) : !fireSettingsAvailable ? (
          <div className="fire-screen mx-auto max-w-5xl px-4 pb-20">
            <Card className="mt-4">
              <CardContent className="p-4">
                <p className="mb-6 text-sm text-gray-600">
                  Let's set up your Financial Independence and Retire Early
                  (FIRE) goals. This will help you track your progress towards
                  financial independence.
                </p>

                <FireSettingsPanel
                  form={fireSettingsForm}
                  onSubmit={handleSaveFireSettings}
                  isSubmitting={isSubmittingFireSettings}
                />
              </CardContent>
            </Card>
          </div>
        ) : activeProjection ? (
          <>
            {userStatus?.status === "satisfied" && (
              <FireHeroCard
                projectedValue={Decimal(activeProjection.projectedValueAtRetirement).toNumber()}
                projectedRetirementAge={activeProjection.projectedRetirementAge}
                targetRetirementAge={activeProjection.targetRetirementAge}
                fireNumber={Decimal(activeProjection.fireNumber).toNumber()}
                fireNumberDecimal={activeProjection.fireNumber}
                contributorBreakdown={activeProjection.projectionResult.contributorBreakdown}
                dateOfBirth={userStatus.dob}
                activeScenario={activeScenario}
                activeGrowthRate={scenarioGrowthRate}
                baseGrowthRate={
                  activeProjection.projectionResult.config.mode === "simple"
                    ? activeProjection.projectionResult.config.growthRate
                    : 8
                }
                onScenarioSelect={handleScenarioSelect}
                onScenarioReset={handleScenarioReset}
              />
            )}
            <div ref={overviewRef}>
              <FireOverviewCard
                targetRetirementAge={activeProjection.targetRetirementAge}
                valueAtRetirement={
                  activeProjection?.projectedValueAtRetirement
                    ? Number(activeProjection.projectedValueAtRetirement)
                    : 0
                }
                fireNumber={activeProjection?.fireNumber ?? null}
                showChart={showChart}
                onToggleChart={toggleChart}
                currentPortfolioValue={
                  activeProjection.projectionResult.totalCurrentValue
                }
                currentPortfolioValueGrowth={createDecimalValueString("0.00")}
                progressPercentage={activeProjection.progressPercentage}
                currentAge={userStatus.currentAge}
                yearsToFire={activeProjection.yearsRemainingToFireTarget}
              />
            </div>
            {!overviewInView ? (
              <>
                <FireOverviewStickyBar
                  targetRetirementAge={activeProjection.targetRetirementAge}
                  valueAtRetirement={
                    activeProjection?.projectedValueAtRetirement
                      ? Number(activeProjection.projectedValueAtRetirement)
                      : 0
                  }
                  fireNumber={activeProjection?.fireNumber ?? null}
                  showChart={showChart}
                  onToggleChart={toggleChart}
                  currentPortfolioValue={
                    activeProjection.projectionResult.totalCurrentValue
                  }
                  progressPercentage={activeProjection.progressPercentage}
                  yearsToFire={activeProjection.yearsRemainingToFireTarget}
                />
                <div aria-hidden className="h-12 shrink-0" />
              </>
            ) : null}
            <>
              <div>
                <Checkbox
                  checked={includePortfolioRecurringContributions}
                  onCheckedChange={
                    handleIncludePortfolioRecurringContributionsChange
                  }
                />
                <Label
                  htmlFor="include-portfolio-contributors"
                  className="font-normal cursor-pointer mx-2"
                >
                  Use portfolio recurring contributions
                </Label>
              </div>
            </>
            {showChart ? (
              <FireProjectionChartCard
                showChart={showChart}
                onToggle={toggleChart}
                projectionData={activeProjection.fireProjectionByAge}
                yearsToFire={activeProjection.yearsRemainingToFireTarget}
                chartConfig={fireChartConfig}
                targetRetirementAge={activeProjection.targetRetirementAge}
                projectedRetirementAge={activeProjection.projectedRetirementAge}
              />
            ) : null}

            <FireSettingsSummaryCard
              form={fireSettingsForm}
              onSubmit={handleSaveFireSettings}
              isSubmitting={isSubmittingFireSettings}
              isDirty={fireSettingsForm.formState.isDirty}
              open={isSettingsEditorOpen}
              onOpenChange={setIsSettingsEditorOpen}
            />

            <WithdrawalStrategyCard
              withdrawalStrategy={activeProjection.withdrawalStrategy}
              contributionsInfo={{
                contributionBreakdown,
                monthlyContributionDifference:
                  activeProjection.monthlyContributionDifference,
              }}
              contributionPreviewState={adjustmentsState.contribution}
              onChangeContributionPreviewState={setContributionPreviewState}
              onResetContributionPreviewState={resetContributionPreviewState}
              onAddContributor={addAdjustmentContributor}
              onUpdateContributor={updateAdjustmentContributor}
              onRemoveContributor={removeAdjustmentContributor}
              onResetContributors={resetAdjustmentContributors}
            />

            {/* <FireContributionsCard
              contributionBreakdown={contributionBreakdown}
              monthlyContributionDifference={
                activeProjection.monthlyContributionDifference
              }
              //StandalonePanelProps (Tochange)
              contributors={projectionContributors}
              onAddContributor={addAdjustmentContributor}
              onUpdateContributor={updateAdjustmentContributor}
              onRemoveContributor={removeAdjustmentContributor}
              onResetContributors={resetAdjustmentContributors}
              //TODO this should not be the adjustment amount.
              //Need to show the total monthly amount of all the contributors.
              //And
              totalMonthlyAmount={adjustmentMonthlyAmount}
              contributionPreviewState={adjustmentsState.contribution}
              onChangeContributionPreviewState={setContributionPreviewState}
              onResetContributionPreviewState={resetContributionPreviewState}
              customStartingValue={customStartingValue}
              onCustomStartingValueChange={setCustomStartingValue}
            /> */}
          </>
        ) : null}
      </div>
    </div>
  );
}
