import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { FireProjectionChartCard } from "@/components/fire/FireProjectionChartCard";
import { FireSettingsPanel } from "@/components/fire/FireSettingsPanel";
import { FireSettingsSummaryCard } from "@/components/fire/FireSettingsSummaryCard";
import { FireSettingsDialog } from "@/components/fire/FireSettingsDialog";
import { ContributionPreviewState } from "@/hooks/use-fire-preview-state";
import { FirePageSkeleton } from "@/components/fire/FirePageSkeleton";
import { FirePageError } from "@/components/fire/FirePageError";
import { FireOverviewCard } from "@/components/fire/FireOverviewCard";
import { FireOverviewStickyBar } from "@/components/fire/FireOverviewStickyBar";
import { WithdrawalStrategyCard } from "@/components/fire/WithdrawalStrategyCard";
import { FireHeroCard } from "@/components/fire/FireHeroCard";
import { FireNowStatus } from "@/components/fire/FireNowStatus";
import {
  FireAccountTypeContributionAdjuster,
  type AccountTypeRowData,
} from "@/components/fire/FireAccountTypeContributionAdjuster";
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

    accountTypeOffsets,
    setAccountTypeOffset,
    resetAccountTypeOffsets,
    baselineProjection,
  } = useFireProjection();

  const deferredProjection = useDeferredValue(activeProjection);
  const projectionForHero = deferredProjection ?? activeProjection;

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

  // Build per-account-type rows for the contribution adjuster.
  // Only include "asset" contributors so that our own offset contributors
  // (type "adjustment") and fire-setting contributors are excluded from
  // the baseline grouping.
  const accountTypeRows = useMemo((): AccountTypeRowData[] => {
    if (!projectionContributors) return [];
    const assetContributors = projectionContributors.filter(
      (c) => c.type === "asset",
    );
    const grouped = new Map<
      string,
      { total: number; withSchedules: number; baselineMonthly: number }
    >();
    for (const c of assetContributors) {
      const at = c.accountType ?? "OTHER";
      const existing = grouped.get(at) ?? {
        total: 0,
        withSchedules: 0,
        baselineMonthly: 0,
      };
      const monthly = c.schedules.reduce(
        (sum, s) => sum + Math.max(0, Number(s.value ?? 0)),
        0,
      );
      grouped.set(at, {
        total: existing.total + 1,
        withSchedules:
          existing.withSchedules + (c.schedules.length > 0 ? 1 : 0),
        baselineMonthly: existing.baselineMonthly + monthly,
      });
    }
    return Array.from(grouped.entries()).map(
      ([accountType, { total, withSchedules, baselineMonthly }]) => ({
        accountType,
        baselineMonthly,
        totalContributors: total,
        contributorsWithSchedules: withSchedules,
      }),
    );
  }, [projectionContributors]);

  const handleAccountTypeOffsetChange = useCallback(
    (accountType: string, delta: number) => {
      setAccountTypeOffset?.(accountType, delta);
    },
    [setAccountTypeOffset],
  );

  const handleAccountTypeReset = useCallback(() => {
    resetAccountTypeOffsets?.();
  }, [resetAccountTypeOffsets]);

  const [isSettingsEditorOpen, setIsSettingsEditorOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
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
            <p className="mb-6 text-sm text-muted-foreground">
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
            <p className="mb-6 text-sm text-muted-foreground">
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
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">FIRE Calculator</h2>
            <p className="text-sm text-muted-foreground">
              Plan your Financial Independence and Retire Early
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open FIRE settings"
            onClick={() => setIsSettingsDialogOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {error ? (
          <FirePageError error={error} />
        ) : !fireSettingsAvailable ? (
          <div className="fire-screen mx-auto max-w-5xl px-4 pb-20">
            <Card className="mt-4">
              <CardContent className="p-4">
                <p className="mb-6 text-sm text-muted-foreground">
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
            {userStatus?.status === "satisfied" && projectionForHero && (
              <FireHeroCard
                projectedValue={Decimal(
                  projectionForHero.projectedValueAtRetirement,
                ).toNumber()}
                projectedRetirementAge={
                  projectionForHero.projectedRetirementAge
                }
                targetRetirementAge={projectionForHero.targetRetirementAge}
                fireNumber={Decimal(projectionForHero.fireNumber).toNumber()}
                fireNumberDecimal={projectionForHero.fireNumber}
                contributorBreakdown={
                  projectionForHero.projectionResult.contributorBreakdown
                }
                dateOfBirth={userStatus.dob}
                activeScenario={activeScenario}
                activeGrowthRate={scenarioGrowthRate}
                baseGrowthRate={
                  projectionForHero.projectionResult.config.mode === "simple"
                    ? projectionForHero.projectionResult.config.growthRate
                    : 8
                }
                onScenarioSelect={handleScenarioSelect}
                onScenarioReset={handleScenarioReset}
              />
            )}
            {fireSettingsForm && projectionForHero && (
              <FireNowStatus
                currentPortfolioValue={
                  projectionForHero.projectionResult.totalCurrentValue
                }
                fireNumber={projectionForHero.fireNumber}
                desiredAnnualIncome={fireSettingsForm.watch("annualIncomeGoal")}
                projectedPortfolioValueAtRetirement={
                  projectionForHero.projectedValueAtRetirement
                }
                safeWithdrawalRate={fireSettingsForm.watch(
                  "safeWithdrawalRate",
                )}
              />
            )}
            {accountTypeRows.length > 0 && activeProjection && (
              <FireAccountTypeContributionAdjuster
                projection={activeProjection}
                baselineProjection={baselineProjection}
                accountTypeRows={accountTypeRows}
                offsets={accountTypeOffsets ?? new Map()}
                onChangeOffset={handleAccountTypeOffsetChange}
                onReset={handleAccountTypeReset}
              />
            )}
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
                //Temporarily satisfy the type whilst we remove monthlyInvestment from the config.
                chartConfig={{
                  ...fireChartConfig,
                  monthlyInvestment: 0,
                }}
                targetRetirementAge={activeProjection.targetRetirementAge}
                projectedRetirementAge={activeProjection.projectedRetirementAge}
              />
            ) : null}

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
      {fireSettingsForm && (
        <FireSettingsDialog
          open={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
          form={fireSettingsForm}
          onSave={handleSaveFireSettings}
          isSubmitting={isSubmittingFireSettings ?? false}
        />
      )}
    </div>
  );
}
