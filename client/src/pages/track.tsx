import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateAge,
  convertToAgeBasedProjection,
} from "@shared/utils/projection-utils";
// import TrackChart from "@/components/charts/TrackChart";
import TrackChart from "@/components/charts/TrackChartD3";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useFireSettings } from "@/hooks/use-fire-settings";
import { usePatchFireSettings } from "@/hooks/use-fire-settings-patch";
import { useSession } from "@/hooks/use-session";
import { useFIREProjection } from "@/hooks/use-projections";
import type { SimpleProjectionConfig } from "@shared/schema/projections";
import { ProjectionModifier, createDecimalValueString } from "@shared/schema";

export default function Track() {
  const { data: portfolioOverview } = usePortfolioOverview();

  const { user } = useSession();
  const currentAge = user?.profile.dob ? calculateAge(user.profile.dob) : NaN;

  const { data: fireSettings } = useFireSettings();
  const { mutateAsync: updateFireSettings } = usePatchFireSettings();

  // Default values if fireSettings is not loaded yet
  const defaultSettings = {
    targetRetirementAge: 60,
    annualIncomeGoal: 48000,
    expectedAnnualReturn: 7,
    safeWithdrawalRate: 4,
    currentAge: 35,
  };

  // Form state
  const [formState, setFormState] = useState({
    retirementAge:
      fireSettings?.targetRetirementAge || defaultSettings.targetRetirementAge,
    targetAmount: fireSettings
      ? Number(fireSettings.annualIncomeGoal) *
        (100 / Number(fireSettings.safeWithdrawalRate))
      : defaultSettings.annualIncomeGoal *
        (100 / defaultSettings.safeWithdrawalRate),
    expectedReturn:
      fireSettings?.expectedAnnualReturn ||
      defaultSettings.expectedAnnualReturn,
  });

  // ============================================================================
  // SERVER AS SOURCE OF TRUTH
  // ============================================================================
  // Use server-calculated FIRE projection for accurate on-track status
  // This includes bonuses, value releases, modifiers, and proper compound growth
  // ============================================================================

  const targetAge =
    formState.retirementAge || defaultSettings.targetRetirementAge;
  const expectedReturn = Number(
    formState.expectedReturn || defaultSettings.expectedAnnualReturn
  );
  const adjustInflation = fireSettings?.adjustInflation ?? true;

  // Create projection config from form state
  const modifiers: ProjectionModifier[] = adjustInflation
    ? [
        {
          type: "inflation",
          enabled: true,
          rate: 2.8,
          description: "Inflation",
        },
      ]
    : [];

  const projectionConfig: Omit<
    SimpleProjectionConfig,
    "startDate" | "endDate"
  > = {
    mode: "simple",
    growthRate: expectedReturn,
    growthModel: "compound",
    interval: "yearly",
    modifiers,
    useContributorSpecificGrowthRates: false,
    usePortfolioRecurringContributions: false,
  };

  const { data: fireProjection } = useFIREProjection(
    projectionConfig,
    undefined
  );

  // Extract on-track status and projection data from server
  const {
    isOnTrack,
    yearsAheadOrBehind,
    monthlyContributionDifference,
    projectedValueAtRetirement,
    fireNumber = 0,
    projectionResult,
  } = fireProjection ?? {};

  // Use server-calculated current value
  const currentPortfolioValue = projectionResult?.totalCurrentValue
    ? Number(projectionResult.totalCurrentValue)
    : portfolioOverview?.value ?? 0;

  // Calculate target amount (FIRE number from form or server)
  const targetAmount = formState.targetAmount || fireNumber || 1200000;

  // Calculate difference and on-track status (convert to numbers for calculations)
  const currentValueNum =
    typeof currentPortfolioValue === "number"
      ? currentPortfolioValue
      : Number(currentPortfolioValue);
  const targetAmountNum =
    typeof targetAmount === "number" ? targetAmount : Number(targetAmount || 0);

  // Calculate expected current amount from projection timePoints at current age
  // Find the timePoint closest to current age
  let expectedCurrentAmount: number = currentValueNum;
  if (projectionResult?.timePoints && user?.profile?.dob) {
    const currentDate = new Date();
    const closestPoint =
      projectionResult.timePoints.find(
        (point) =>
          Math.abs(point.date.getTime() - currentDate.getTime()) <
          30 * 24 * 60 * 60 * 1000 // Within 30 days
      ) || projectionResult.timePoints[0];

    if (closestPoint) {
      // Linear interpolation: if we're not exactly at a timePoint, interpolate
      // For simplicity, use the closest point's value
      expectedCurrentAmount = Number(closestPoint.value);
    }
  }

  const difference = currentValueNum - expectedCurrentAmount;
  const percentageOfTarget =
    targetAmountNum > 0 ? (currentValueNum / targetAmountNum) * 100 : 0;

  // On-track status (use server calculation if available, otherwise calculate locally)
  const onTrackStatus = {
    isOnTrack: isOnTrack ?? difference >= 0,
    expectedCurrentAmount,
    difference,
    percentageOfTarget: Math.min(100, Math.max(0, percentageOfTarget)),
  };

  // Handle form submission
  const handleRecalculate = async () => {
    if (!fireSettings) return;

    try {
      await updateFireSettings({
        targetRetirementAge: formState.retirementAge,
        // Calculate annual income goal based on target amount and withdrawal rate
        annualIncomeGoal: createDecimalValueString(
          (
            formState.targetAmount *
            (Number(fireSettings.safeWithdrawalRate) / 100)
          ).toString(),
        ),
        //Temporarily satisfy the type whilst we remove expectedAnnualReturn from the settings.
        // expectedAnnualReturn: createDecimalValueString(
        //   formState.expectedReturn.toString(),
        // ),
        safeWithdrawalRate: fireSettings.safeWithdrawalRate,
        //Temporarily satisfy the type whilst we remove monthlyInvestment from the settings.
        //monthlyInvestment: fireSettings.monthlyInvestment,
        adjustInflation: fireSettings.adjustInflation ?? true,
        includeStatePension: fireSettings.includeStatePension ?? false,
        incomeGoals: fireSettings.incomeGoals ?? [],
      });
    } catch (error) {
      console.error("Error updating FIRE settings:", error);
    }
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setFormState({
        ...formState,
        [field]: numValue,
      });
    }
  };

  // Monthly adjustment from server (properly calculated with growth rate)
  // Use server's monthlyShortfall if available, otherwise calculate from difference
  const monthlyAdjustment =
    !onTrackStatus.isOnTrack && monthlyContributionDifference
      ? Number(monthlyContributionDifference)
      : !onTrackStatus.isOnTrack
      ? Math.ceil(
          Math.abs(onTrackStatus.difference) / ((targetAge - currentAge) * 12)
        )
      : 0;

  // ============================================================================
  // CONVERT SERVER PROJECTION TO AGE-BASED DATA FOR CHART
  // ============================================================================
  // Transform server timePoints to age-based format for chart display
  // This ensures the chart shows the authoritative server projection
  // including bonuses, value releases, and modifiers
  // ============================================================================
  const trackProjectionData =
    user?.profile?.dob && projectionResult
      ? convertToAgeBasedProjection(
          projectionResult.timePoints,
          user.profile.dob,
          createDecimalValueString(targetAmountNum.toString())
        )
      : [];

  return (
    <div className="track-screen max-w-5xl mx-auto px-4 pb-20">
      <Card className="mt-4">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-3">Track Your Progress</h2>
          <p className="text-sm text-muted-foreground mb-6">
            See if you're on track to reach your retirement goals
          </p>

          {/* Chart */}
          <TrackChart
            targetAge={targetAge}
            targetAmount={targetAmountNum}
            currentAge={currentAge}
            currentAmount={currentValueNum}
            projectionData={trackProjectionData}
            className="mb-6"
          />

          {/* FIRE Goal Progress */}
          <div className="bg-muted rounded-lg p-4 mb-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium">FIRE Goal Progress</h3>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">
                    £{currentValueNum.toLocaleString()} of £
                    {targetAmountNum.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="progress-bar mt-2">
              <div
                className="progress-bar-fill bg-primary"
                style={{ width: `${onTrackStatus.percentageOfTarget}%` }}
              ></div>
            </div>
                <p className="text-right text-xs text-muted-foreground mt-1">
              {onTrackStatus.percentageOfTarget.toFixed(1)}% complete
            </p>
          </div>

          {/* Current Progress vs Expected */}
          <div className="bg-muted rounded-lg p-4 mb-6">
            <h3 className="font-medium mb-3">Current Progress vs Expected</h3>
            <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted-foreground">Your current total:</span>
              <span className="font-medium">
                £{currentValueNum.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">
                Expected by now (age {currentAge}):
              </span>
              <span className="font-medium">
                £
                {Math.round(
                  Number(onTrackStatus.expectedCurrentAmount)
                ).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-muted-foreground">Difference:</span>
              <span
                className={`font-medium ${
                  onTrackStatus.isOnTrack ? "text-secondary" : "text-error"
                }`}
              >
                {onTrackStatus.difference >= 0 ? "+" : "-"}£
                {Math.abs(
                  Math.round(onTrackStatus.difference)
                ).toLocaleString()}
              </span>
            </div>

            {!onTrackStatus.isOnTrack && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm">
                  To stay on track, consider increasing your monthly investment
                  by <span className="font-medium">£{monthlyAdjustment}</span>
                </p>
              </div>
            )}
          </div>

          {/* Adjust Goals */}
          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-medium mb-3">Adjust Your Goals</h3>

            <div className="mb-4">
              <Label
                htmlFor="retirement-age"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Retirement Age
              </Label>
              <Input
                id="retirement-age"
                type="number"
                value={formState.retirementAge}
                onChange={(e) =>
                  handleInputChange("retirementAge", e.target.value)
                }
              />
            </div>

            <div className="mb-4">
              <Label
                htmlFor="target-amount"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Target FIRE Amount
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground">£</span>
                </div>
                <Input
                  id="target-amount"
                  type="number"
                  className="pl-7"
                  value={formState.targetAmount}
                  onChange={(e) =>
                    handleInputChange("targetAmount", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="mb-4">
              <Label
                htmlFor="expected-return"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Expected Annual Return (%)
              </Label>
              <Input
                id="expected-return"
                type="number"
                value={formState.expectedReturn}
                onChange={(e) =>
                  handleInputChange("expectedReturn", e.target.value)
                }
              />
            </div>

            <Button
              className="w-full bg-primary text-white"
              onClick={handleRecalculate}
            >
              Recalculate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
