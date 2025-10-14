import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateOnTrackStatus } from "@shared/utils/tracking";
import TrackChart from "@/components/charts/TrackChart";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useFireSettings } from "@/hooks/use-fire-settings";
import { usePatchFireSettings } from "@/hooks/use-patch-fire-settings";

export default function Track() {

  const { data: portfolioOverview } = usePortfolioOverview();

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

  // Calculate on track status
  const targetAmount = formState.targetAmount || 1200000;
  const currentAge = fireSettings?.currentAge || defaultSettings.currentAge;
  const targetAge =
    formState.retirementAge || defaultSettings.targetRetirementAge;

  const onTrackStatus = calculateOnTrackStatus({
    currentAge,
    targetAge,
    currentAmount: portfolioOverview?.value ?? 0,
    targetAmount,
  });

  // Handle form submission
  const handleRecalculate = async () => {
    if (!fireSettings) return;

    try {
      await updateFireSettings({
        targetRetirementAge: formState.retirementAge,
        // Calculate annual income goal based on target amount and withdrawal rate
        annualIncomeGoal: (
          formState.targetAmount *
          (Number(fireSettings.safeWithdrawalRate) / 100)
        ).toString(),
        expectedAnnualReturn: formState.expectedReturn.toString(),
        safeWithdrawalRate: fireSettings.safeWithdrawalRate,
        monthlyInvestment: fireSettings.monthlyInvestment,
        currentAge: fireSettings.currentAge,
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

  // Calculate monthly investment needed to get back on track
  const calculateMonthlyAdjustment = () => {
    if (onTrackStatus.isOnTrack) return 0;

    // Simple approximation - actual calculation would be more complex
    const yearsLeft = targetAge - currentAge;
    const monthsLeft = yearsLeft * 12;

    // How much extra total is needed
    const shortfall = Math.abs(onTrackStatus.difference);

    // Divide by months and add buffer
    return Math.ceil(shortfall / monthsLeft) + 50; // Round up to nearest 10
  };

  const monthlyAdjustment = calculateMonthlyAdjustment();

  return (
    <div className="track-screen max-w-5xl mx-auto px-4 pb-20">
      <Card className="mt-4">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-3">Track Your Progress</h2>
          <p className="text-sm text-gray-600 mb-6">
            See if you're on track to reach your retirement goals
          </p>

          {/* Chart */}
          <TrackChart
            targetAge={targetAge}
            targetAmount={targetAmount}
            currentAge={currentAge}
            currentAmount={portfolioOverview?.value ?? 0}
            className="mb-6"
          />

          {/* FIRE Goal Progress */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium">FIRE Goal Progress</h3>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">
                    £{portfolioOverview?.value?.toLocaleString() ?? 0} of £
                    {targetAmount.toLocaleString()}
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
            <p className="text-right text-xs text-gray-500 mt-1">
              {onTrackStatus.percentageOfTarget.toFixed(1)}% complete
            </p>
          </div>

          {/* Current Progress vs Expected */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium mb-3">Current Progress vs Expected</h3>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Your current total:</span>
              <span className="font-medium">
                £{portfolioOverview?.value?.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">
                Expected by now (age {currentAge}):
              </span>
              <span className="font-medium">
                £
                {Math.round(
                  onTrackStatus.expectedCurrentAmount
                ).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Difference:</span>
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
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm">
                  To stay on track, consider increasing your monthly investment
                  by <span className="font-medium">£{monthlyAdjustment}</span>
                </p>
              </div>
            )}
          </div>

          {/* Adjust Goals */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-3">Adjust Your Goals</h3>

            <div className="mb-4">
              <Label
                htmlFor="retirement-age"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Target FIRE Amount
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">£</span>
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
                className="block text-sm font-medium text-gray-700 mb-1"
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
