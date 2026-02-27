import { useFormContext } from "react-hook-form";
import { FireSettingsInsert } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export type FireSettingsFormValues = Omit<
  FireSettingsInsert,
  "incomeGoals" | "userAccountId" | "monthlyInvestment" | "expectedAnnualReturn"
> & {
  reduceSpendingAt75: boolean;
};

const numericInputClassName = "text-3xl font-bold border-none shadow-none bg-transparent p-0 focus-visible:ring-0 w-full";

export const FireSettingsForm = () => {
  const form = useFormContext<FireSettingsFormValues>();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
        <FormField
          control={form.control}
          name="annualIncomeGoal"
          render={({ field }) => (
            <FormItem className="bg-muted/50 p-4 space-y-1.5">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                Income Goal
              </FormLabel>
              <FormControl>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold">£</span>
                  <NumericInput
                    value={field.value}
                    onValueChange={field.onChange}
                    decimalScale={0}
                    className={numericInputClassName}
                  />
                </div>
              </FormControl>
              <div className="text-xs text-muted-foreground">/yr</div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="safeWithdrawalRate"
          render={({ field }) => (
            <FormItem className="bg-muted/50 p-4 space-y-1.5">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                Withdrawal Rate
              </FormLabel>
              <FormControl>
                <div className="flex items-baseline gap-0.5">
                  <NumericInput
                    value={field.value}
                    onValueChange={field.onChange}
                    decimalScale={1}
                    thousandSeparator={false}
                    className={numericInputClassName}
                  />
                  <span className="text-2xl font-bold">%</span>
                </div>
              </FormControl>
              <div className="text-xs text-muted-foreground">safe rate</div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targetRetirementAge"
          render={({ field }) => (
            <FormItem className="bg-muted/50 p-4 space-y-1.5">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                Retire At
              </FormLabel>
              <FormControl>
                <NumericInput
                  value={field.value}
                  onValueChange={(val) => field.onChange(val === "" ? "" : Number(val))}
                  decimalScale={0}
                  thousandSeparator={false}
                  className={numericInputClassName}
                />
              </FormControl>
              <div className="text-xs text-muted-foreground">years old</div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-3">
        <FormField
          control={form.control}
          name="includeStatePension"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4">
              <FormLabel className="text-sm font-medium leading-snug cursor-pointer">
                Include State Pension
                <span className="block text-xs text-muted-foreground font-normal">
                  Based on your date of birth and gender
                </span>
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reduceSpendingAt75"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4">
              <FormLabel className="text-sm font-medium leading-snug cursor-pointer">
                Reduce spending at 75
                <span className="block text-xs text-muted-foreground font-normal">
                  75% of desired annual income at age 75
                </span>
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="adjustInflation"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4">
              <FormLabel className="text-sm font-medium leading-snug cursor-pointer">
                Adjust for inflation
                <span className="block text-xs text-muted-foreground font-normal">
                  Average 2.8% over the past 30 years
                </span>
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
