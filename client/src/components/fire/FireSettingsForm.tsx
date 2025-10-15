import { useFormContext } from "react-hook-form";
import { FireSettingsInsert } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

export const FireSettingsForm = () => {
  const form = useFormContext<FireSettingsInsert>();

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="annualIncomeGoal"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
              Desired Annual Income in Retirement
            </FormLabel>
            <FormDescription>
              Your desired annual income in today's money.
            </FormDescription>
            <FormControl>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">£</span>
                </div>
                <Input {...field} type="number" step="0.01" className="pl-7" />
              </div>
            </FormControl>
            <p className="text-xs text-gray-500 mt-1">
              Your desired annual income in today's money.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="expectedAnnualReturn"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
              Expected Annual Return (%)
            </FormLabel>
            <FormDescription>
              This is the rate at which you expect your investments to grow each
              year (Linear not compounded).
            </FormDescription>
            <FormControl>
              <Input {...field} type="number" step="0.01" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="safeWithdrawalRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
              Safe Withdrawal Rate (%)
            </FormLabel>
            <FormDescription>
              This is the rate at which you hope to safely withdraw from your
              pensions in retirement.
            </FormDescription>
            <FormControl>
              <Input {...field} type="number" step="0.01" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="monthlyInvestment"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
              Intended Monthly Investment
            </FormLabel>
            <FormDescription>
              This is your intent, and will be compared to your actual monthly
              cntributions.
            </FormDescription>
            <FormControl>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">£</span>
                </div>
                <Input {...field} type="number" step="0.01" className="pl-7" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="targetRetirementAge"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
              Desired Retirement Age
            </FormLabel>
            <FormDescription>
              This is the age you hope to retire at.
            </FormDescription>
            <FormControl>
              <Input {...field} type="number" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="adjustInflation"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center space-x-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel className="text-sm cursor-pointer !mt-0">
                Adjust for inflation{" "}
                <span className="italic font-normal text-gray-500">
                  (average 2.8% over the past 30 years)
                </span>
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
