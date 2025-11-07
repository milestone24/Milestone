import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/context/PortfolioContext";
import { calculateContributionImpactWithProjections } from "@shared/utils/projection-client";
import FireChart from "@/components/charts/FireChart";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_STATE_PENSION_AGE,
  DEFAULT_TARGET_RETIREMENT_AGE,
  FireSettingsInsert,
  fireSettingsInsertSchema,
  fireSettingsOrphanSchema,
  ProjectionModifier,
  createDecimalValueString,
} from "@shared/schema";
import type { SimpleProjectionConfig } from "@shared/schema/projections";
import { useSession } from "@/hooks/use-session";
import { useFIREProjection } from "@/hooks/use-projections";
import {
  calculateAge,
  convertToAgeBasedProjection,
} from "@shared/utils/projection-utils";
import { useFireSettings } from "@/hooks/use-fire-settings";
import { usePatchFireSettings } from "@/hooks/use-fire-settings-patch";
import { useCreateFireSettings } from "@/hooks/use-fire-settings-create";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useForm, FormProvider } from "react-hook-form";
import { FireSettingsForm } from "@/components/fire/FireSettingsForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "lucide-react";

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

  const currentAge = user?.profile.dob ? calculateAge(user.profile.dob) : NaN;
  const statePensionAge = calculateStatePensionAge(user?.profile.dob);

  const { data: portfolioOverview } = usePortfolioOverview();

  const { data: fireSettings, isLoading: isLoadingFireSettings } =
    useFireSettings();
  const { mutateAsync: updateFireSettings } = usePatchFireSettings();
  const { mutateAsync: createFireSettings } = useCreateFireSettings();

  // Single form instance for the entire page
  const form = useForm<FireSettingsInsert>({
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

  const { formState, handleSubmit } = form;

  const errors = formState.errors;
  //console.log("errors", errors);

  const isValid = formState.isValid;
  //console.log("isValid", isValid);

  const isSubmitting = formState.isSubmitting;
  //console.log("isSubmitting", isSubmitting);

  // Watch values for calculations
  const watchedValues = form.watch();

  // Helper variables for numeric conversions (used in calculations and display)
  // These convert DecimalValueString form values to numbers where needed
  const monthlyInvestment = Number(watchedValues.monthlyInvestment || 0);
  const expectedReturn = Number(watchedValues.expectedAnnualReturn || 0);
  const withdrawalRate = Number(watchedValues.safeWithdrawalRate || 0);
  const annualIncomeGoal = Number(watchedValues.annualIncomeGoal || 0);
  const targetRetirementAge = Number(
    watchedValues.targetRetirementAge || DEFAULT_TARGET_RETIREMENT_AGE
  );
  const adjustInflation = watchedValues.adjustInflation ?? true;

  // Update form when fireSettings loads
  useEffect(() => {
    if (fireSettings) {
      form.reset({
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
  }, [fireSettings, form, statePensionAge]);

  const mod: ProjectionModifier = {
    type: "contribution_scaler",
    enabled: true,
    scaleFactor: 10.0,
    description: "Contribution Scaler",
  };

  const modifiers: ProjectionModifier[] = adjustInflation
    ? [
        {
          type: "inflation",
          enabled: true,
          rate: 2.8,
          description: "Inflation",
        },
        mod,
      ]
    : [mod];

  const projectionConfig: Omit<
    SimpleProjectionConfig,
    "startDate" | "endDate"
  > = {
    mode: "simple",
    growthRate: 7.0,
    growthModel: "linear",
    interval: "yearly",
    modifiers,
  };

  const { data: currentProjection } = useFIREProjection(
    projectionConfig,
    undefined
  );

  const {
    yearsAheadOrBehind,
    fireNumber = 0,
    projectedRetirementDate,
    projectedRetirementAge,
    monthlyShortfall,
    projectionResult,
  } = currentProjection ?? {};

  const { computationContext } = projectionResult ?? {};

  // ============================================================================
  // SERVER AS SOURCE OF TRUTH
  // ============================================================================
  // The main projection data comes from the server, which includes:
  // - Bonuses (e.g., LISA 25% government bonus)
  // - Value releases (age/date-based access restrictions)
  // - Account-specific modifiers (tax, fees, inflation)
  // - Accurate compound growth calculations
  //
  // Client-side calculations are ONLY used for preview/what-if scenarios
  // (e.g., "what if I increase contributions by £100/month")
  // ============================================================================

  // Convert server-calculated timePoints to age-based projection data
  // This uses the server's projection which includes bonuses, value releases, and modifiers
  const fireProjectionData =
    user?.profile?.dob && projectionResult
      ? convertToAgeBasedProjection(
          projectionResult.timePoints,
          user.profile.dob,
          createDecimalValueString(fireNumber.toString())
        )
      : [];

  const yearsToFire = yearsAheadOrBehind ?? 0;

  // Get full contributors from computation context for impact calculations
  // This preserves bonuses, value releases, and account-specific logic
  const contributorsForFire = computationContext?.contributors ?? [];

  // Prepare config for FireChart component
  // Use projection result values instead of portfolio overview for consistency
  const currentPortfolioValue: number = projectionResult?.totalCurrentValue
    ? Number(projectionResult.totalCurrentValue)
    : Number(portfolioOverview?.value ?? 0);

  // FireChart expects number types for config
  const fireConfig = {
    currentAmount: currentPortfolioValue,
    monthlyInvestment,
    expectedReturn,
    targetAmount: fireNumber,
    currentAge,
  };

  console.log("yearsToFire", yearsToFire);

  // Calculate the impact of changing monthly investment
  // Use current portfolio value from projection result for consistency
  const currentPortfolioValueDecimal = projectionResult?.totalCurrentValue
    ? projectionResult.totalCurrentValue
    : createDecimalValueString(currentPortfolioValue.toString());

  // ============================================================================
  // CLIENT-SIDE PREVIEW CALCULATIONS
  // ============================================================================
  // These calculations are for "what-if" scenarios only.
  // They provide quick previews without server round-trips.
  // For authoritative projections, always use server-calculated data.
  // ============================================================================

  // Calculate impact using full contributor model
  // This preserves bonuses and value releases in the calculation
  const increaseImpact = calculateContributionImpactWithProjections(
    currentPortfolioValueDecimal,
    contributorsForFire,
    createDecimalValueString((monthlyInvestment + 100).toString()),
    expectedReturn,
    createDecimalValueString(fireNumber.toString()),
    currentAge
  );

  const decreaseImpact = calculateContributionImpactWithProjections(
    currentPortfolioValueDecimal,
    contributorsForFire,
    createDecimalValueString((monthlyInvestment - 100).toString()),
    expectedReturn,
    createDecimalValueString(fireNumber.toString()),
    currentAge
  );

  // Projected retirement age - use value from server if available, otherwise calculate
  const calculatedProjectedRetirementAge = projectedRetirementAge
    ? Math.round(projectedRetirementAge)
    : Math.round(currentAge + yearsToFire);

  // Handle adjusting the monthly investment
  //This should not modify the fire settings imediately, it should show a preview
  //of the potential change
  const handleAdjustInvestment = async (adjustment: number) => {
    if (!fireSettings) return;

    const currentMonthlyInvestment = Number(watchedValues.monthlyInvestment);
    const newMonthlyInvestment = currentMonthlyInvestment + adjustment;

    try {
      await updateFireSettings({
        ...watchedValues,
        monthlyInvestment: createDecimalValueString(
          newMonthlyInvestment.toString()
        ),
      });

      form.setValue(
        "monthlyInvestment",
        createDecimalValueString(newMonthlyInvestment.toString())
      );
    } catch (error) {
      console.error("Error updating monthly investment:", error);
    }
  };

  // Handle form submission
  const handleSaveSettings = form.handleSubmit(async (data) => {
    const settings: Omit<FireSettingsInsert, "id" | "userAccountId"> = {
      ...data,
    };

    try {
      if (!fireSettings) {
        await createFireSettings(settings);
      } else {
        await updateFireSettings(settings);
      }
      toast({
        title: "Settings saved",
        description: "Your FIRE settings have been saved successfully.",
      });
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
      <div className="fire-screen max-w-5xl mx-auto px-4 pb-20">
        <Card className="mt-4">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-3">FIRE Calculator</h2>
            <p className="text-sm text-gray-600 mb-6">
              You must set your date of birth before you can use the FIRE
              calculator. This should be done in your profile setings.
            </p>
            <Link href="/profile">Go to Profile</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no FIRE settings exist, show initial setup
  if (!fireSettings) {
    return (
      <div className="fire-screen max-w-5xl mx-auto px-4 pb-20">
        <Card className="mt-4">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-3">
              Welcome to FIRE Planning
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Let's set up your Financial Independence and Retire Early (FIRE)
              goals. This will help you track your progress towards financial
              independence.
            </p>

            <FormProvider {...form}>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <FireSettingsForm />
                <Button
                  type="submit"
                  className="w-full bg-primary text-white py-2 rounded-lg font-medium mt-4"
                >
                  Save FIRE Settings
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main FIRE calculator view
  return (
    <div className="fire-screen max-w-5xl mx-auto px-2 md:px-4 pb-20">
      <div className="w-full flex flex-col">
        <h2 className="text-lg font-semibold mb-3">FIRE Calculator</h2>
        <p className="text-sm text-gray-600 mb-6">
          Plan your Financial Independence and Retire Early
        </p>

        {/* FIRE Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-3">Your FIRE Summary</h3>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Current portfolio:</span>
            <span className="font-medium">
              £{currentPortfolioValue.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">
              FIRE number (Retirement Target):
            </span>
            <span className="font-medium">£{fireNumber.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">
              Annual sustainable income ({withdrawalRate}%):
            </span>
            <span className="font-medium">
              £{annualIncomeGoal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">
              Projected retirement age:
            </span>
            <span className="font-medium">
              {calculatedProjectedRetirementAge} years
            </span>
          </div>
        </div>

        {/* Chart */}
        <FireChart
          projectionData={fireProjectionData}
          yearsToFire={yearsToFire}
          config={fireConfig}
          targetRetirementAge={targetRetirementAge}
          projectedRetirementAge={calculatedProjectedRetirementAge}
          className="mb-6"
        />

        {/* FIRE Settings */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-3">Your FIRE Settings</h3>

          <FormProvider {...form}>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <FireSettingsForm />
              <Button
                type="submit"
                className="w-full bg-primary text-white py-2 rounded-lg font-medium mt-4"
              >
                Save Settings
              </Button>
            </form>
          </FormProvider>
        </div>

        {/* Adjust Investment */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium mb-3">Adjust Your Investment</h3>

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Current Monthly Investment
            </p>
            <p className="text-2xl font-bold">
              £{monthlyInvestment.toLocaleString()}
            </p>
          </div>

          <div className="flex space-x-2 mb-4">
            <Button
              variant="outline"
              className="flex-1 py-2 px-3"
              onClick={() => handleAdjustInvestment(-100)}
              disabled={monthlyInvestment <= 100}
            >
              -£100/month
            </Button>
            <Button
              className="flex-1 py-2 px-3 bg-primary text-white"
              onClick={() => handleAdjustInvestment(100)}
            >
              +£100/month
            </Button>
          </div>

          <div className="px-3 py-2 bg-blue-50 rounded-lg text-blue-700 text-sm">
            {increaseImpact.monthsDifference > 0 ? (
              <p>
                By increasing your monthly investment by £100, you could retire{" "}
                <span className="font-medium">
                  {increaseImpact.monthsDifference > 12
                    ? `${Math.floor(
                        increaseImpact.monthsDifference / 12
                      )} years and ${
                        increaseImpact.monthsDifference % 12
                      } months`
                    : `${increaseImpact.monthsDifference} months`}{" "}
                  earlier
                </span>
                .
              </p>
            ) : (
              <p>
                By decreasing your monthly investment by £100, your retirement
                would be delayed by{" "}
                <span className="font-medium">
                  {decreaseImpact.monthsDifference > 12
                    ? `${Math.floor(
                        Math.abs(decreaseImpact.monthsDifference) / 12
                      )} years and ${
                        Math.abs(decreaseImpact.monthsDifference) % 12
                      } months`
                    : `${Math.abs(decreaseImpact.monthsDifference)} months`}
                </span>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
