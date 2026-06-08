import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  calculateAge,
  convertToAgeBasedProjection,
} from "@milestone/js-common/utils/projection-utils";
import { usePortfolioOverview } from "@milestone/js-common/react/hooks/use-portfolio-overview";
import { useFireSettings } from "@milestone/js-common/react/hooks/use-fire-settings";
import { usePatchFireSettings } from "@milestone/js-common/react/hooks/use-fire-settings-patch";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import { useFIREProjection } from "@milestone/js-common/react/hooks/use-projections";
import type { SimpleProjectionConfig } from "@milestone/js-common/schema/projections";
import { ProjectionModifier, createDecimalValueString } from "@milestone/js-common/schema";
import TrackChart from "@/components/charts/TrackChart";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TrackScreen() {
  const { data: portfolioOverview } = usePortfolioOverview();
  const { user } = useSession();
  const currentAge = user?.profile.dob ? calculateAge(user.profile.dob) : NaN;
  const { data: fireSettings } = useFireSettings();
  const { mutateAsync: updateFireSettings, isPending: isUpdating } = usePatchFireSettings();

  const defaultSettings = {
    targetRetirementAge: 60,
    annualIncomeGoal: 48000,
    expectedAnnualReturn: 7,
    safeWithdrawalRate: 4,
    currentAge: 35,
  };

  const [formState, setFormState] = useState({
    retirementAge:
      fireSettings?.targetRetirementAge || defaultSettings.targetRetirementAge,
    targetAmount: fireSettings
      ? Number(fireSettings.annualIncomeGoal) *
        (100 / Number(fireSettings.safeWithdrawalRate))
      : defaultSettings.annualIncomeGoal *
        (100 / defaultSettings.safeWithdrawalRate),
    expectedReturn:
      fireSettings?.expectedAnnualReturn || defaultSettings.expectedAnnualReturn,
  });

  const targetAge = formState.retirementAge || defaultSettings.targetRetirementAge;
  const expectedReturn = Number(
    formState.expectedReturn || defaultSettings.expectedAnnualReturn
  );
  const adjustInflation = fireSettings?.adjustInflation ?? true;

  const modifiers: ProjectionModifier[] = adjustInflation
    ? [{ type: "inflation", enabled: true, rate: 2.8, description: "Inflation" }]
    : [];

  const projectionConfig: Omit<SimpleProjectionConfig, "startDate" | "endDate"> = {
    mode: "simple",
    growthRate: expectedReturn,
    growthModel: "compound",
    interval: "yearly",
    modifiers,
    useContributorSpecificGrowthRates: false,
    usePortfolioRecurringContributions: false,
  };

  const { data: fireProjection } = useFIREProjection(projectionConfig, undefined);

  const {
    isOnTrack,
    monthlyContributionDifference,
    projectionResult,
    fireNumber = 0,
  } = fireProjection ?? {};

  const currentPortfolioValue = projectionResult?.totalCurrentValue
    ? Number(projectionResult.totalCurrentValue)
    : portfolioOverview?.value
      ? Number(portfolioOverview.value)
      : 0;

  const targetAmount = formState.targetAmount || fireNumber || 1200000;
  const currentValueNum = currentPortfolioValue;
  const targetAmountNum = Number(targetAmount);

  let expectedCurrentAmount = currentValueNum;
  if (projectionResult?.timePoints && user?.profile?.dob) {
    const currentDate = new Date();
    const closestPoint =
      projectionResult.timePoints.find(
        (point) =>
          Math.abs(point.date.getTime() - currentDate.getTime()) <
          30 * 24 * 60 * 60 * 1000
      ) || projectionResult.timePoints[0];

    if (closestPoint) {
      expectedCurrentAmount = Number(closestPoint.value);
    }
  }

  const difference = currentValueNum - expectedCurrentAmount;
  const percentageOfTarget =
    targetAmountNum > 0 ? (currentValueNum / targetAmountNum) * 100 : 0;

  const onTrackStatus = {
    isOnTrack: isOnTrack ?? difference >= 0,
    expectedCurrentAmount,
    difference,
    percentageOfTarget: Math.min(100, Math.max(0, percentageOfTarget)),
  };

  const monthlyAdjustment =
    !onTrackStatus.isOnTrack && monthlyContributionDifference
      ? Number(monthlyContributionDifference)
      : !onTrackStatus.isOnTrack
        ? Math.ceil(
            Math.abs(onTrackStatus.difference) / ((targetAge - currentAge) * 12)
          )
        : 0;

  const trackProjectionData =
    user?.profile?.dob && projectionResult
      ? convertToAgeBasedProjection(
          projectionResult.timePoints,
          user.profile.dob,
          createDecimalValueString(targetAmountNum.toString())
        )
      : [];

  const handleRecalculate = async () => {
    if (!fireSettings) return;

    await updateFireSettings({
      targetRetirementAge: formState.retirementAge,
      annualIncomeGoal: createDecimalValueString(
        (
          formState.targetAmount *
          (Number(fireSettings.safeWithdrawalRate) / 100)
        ).toString()
      ),
      safeWithdrawalRate: fireSettings.safeWithdrawalRate,
      adjustInflation: fireSettings.adjustInflation ?? true,
      includeStatePension: fireSettings.includeStatePension ?? false,
      incomeGoals: fireSettings.incomeGoals ?? [],
    });
  };

  const handleInputChange = (field: keyof typeof formState, value: string) => {
    const numValue = parseFloat(value);
    if (!Number.isNaN(numValue)) {
      setFormState((prev) => ({ ...prev, [field]: numValue }));
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 pb-24">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-1">
            Track Your Progress
          </Text>
          <Text className="text-sm text-muted-foreground mb-4">
            See if you&apos;re on track to reach your retirement goals
          </Text>

          <TrackChart
            targetAge={targetAge}
            targetAmount={targetAmountNum}
            currentAge={currentAge}
            currentAmount={currentValueNum}
            projectionData={trackProjectionData}
            className="mb-4"
          />

          <View className="bg-muted rounded-lg p-4 mb-4">
            <Text className="font-medium text-foreground mb-2">FIRE Goal Progress</Text>
            <Text className="text-sm text-muted-foreground mb-2">
              £{currentValueNum.toLocaleString()} of £{targetAmountNum.toLocaleString()}
            </Text>
            <View className="h-2 rounded-full bg-background overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${onTrackStatus.percentageOfTarget}%` }}
              />
            </View>
            <Text className="text-right text-xs text-muted-foreground mt-1">
              {onTrackStatus.percentageOfTarget.toFixed(1)}% complete
            </Text>
          </View>

          <View className="bg-muted rounded-lg p-4 mb-4">
            <Text className="font-medium text-foreground mb-3">Current Progress vs Expected</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-muted-foreground">Your current total:</Text>
              <Text className="font-medium text-foreground">
                £{currentValueNum.toLocaleString()}
              </Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-muted-foreground">
                Expected by now (age {currentAge}):
              </Text>
              <Text className="font-medium text-foreground">
                £{Math.round(Number(onTrackStatus.expectedCurrentAmount)).toLocaleString()}
              </Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-muted-foreground">Difference:</Text>
              <Text
                className={onTrackStatus.isOnTrack ? "text-positive font-medium" : "text-negative font-medium"}
              >
                {onTrackStatus.difference >= 0 ? "+" : "-"}£
                {Math.abs(Math.round(onTrackStatus.difference)).toLocaleString()}
              </Text>
            </View>
            {!onTrackStatus.isOnTrack ? (
              <Text className="text-sm text-foreground mt-3 pt-3 border-t border-border">
                To stay on track, consider increasing monthly investment by £{monthlyAdjustment}
              </Text>
            ) : null}
          </View>

          <View className="bg-muted rounded-lg p-4">
            <Text className="font-medium text-foreground mb-3">Adjust Your Goals</Text>
            <View className="mb-4">
              <Label>Retirement Age</Label>
              <Input
                keyboardType="numeric"
                value={String(formState.retirementAge)}
                onChangeText={(value) => handleInputChange("retirementAge", value)}
              />
            </View>
            <View className="mb-4">
              <Label>Target Amount (£)</Label>
              <Input
                keyboardType="numeric"
                value={String(formState.targetAmount)}
                onChangeText={(value) => handleInputChange("targetAmount", value)}
              />
            </View>
            <View className="mb-4">
              <Label>Expected Annual Return (%)</Label>
              <Input
                keyboardType="numeric"
                value={String(formState.expectedReturn)}
                onChangeText={(value) => handleInputChange("expectedReturn", value)}
              />
            </View>
            <Button
              label={isUpdating ? "Updating..." : "Recalculate"}
              disabled={isUpdating}
              onPress={handleRecalculate}
            />
          </View>
        </CardContent>
      </Card>
      </View>
    </ScrollView>
  );
}
