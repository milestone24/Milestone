import { useFormContext } from "react-hook-form";
import { FireSettingsInsert } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { NumericInput } from "@/components/ui/numeric-input";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const numericInputClassName = "text-lg font-semibold border-none shadow-none bg-transparent p-0 focus-visible:ring-0 w-full";

export const FireSettingsForm = () => {
  const form = useFormContext<FireSettingsFormValues>();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
        <FormField
          control={form.control}
          name="annualIncomeGoal"
          render={({ field }) => (
            <FormItem className="p-4 space-y-2">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Income Goal
              </FormLabel>
              <FormControl>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-semibold">£</span>
                  <NumericInput
                    value={field.value}
                    onValueChange={field.onChange}
                    decimalScale={0}
                    className={numericInputClassName}
                  />
                  <span className="text-sm text-muted-foreground">/yr</span>
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
            <FormItem className="p-4 space-y-2">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Target Age
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
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="safeWithdrawalRate"
          render={({ field }) => (
            <FormItem className="p-4 space-y-2">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
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
                  <span className="text-lg font-semibold">%</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div>
        <FormField
          control={form.control}
          name="adjustInflation"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between py-4">
              <div className="flex items-center gap-1.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Adjust for inflation
                </FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-muted-foreground cursor-help">
                      <Info className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Adjusts projections to account for inflation over time (average 2.8% over the past 30 years)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <Separator />
        <FormField
          control={form.control}
          name="includeStatePension"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between py-4">
              <div className="flex items-center gap-1.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Include State Pension
                </FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-muted-foreground cursor-help">
                      <Info className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Includes estimated UK State Pension income based on your date of birth and gender
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <Separator />
        <FormField
          control={form.control}
          name="reduceSpendingAt75"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between py-4">
              <div className="flex items-center gap-1.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Reduced spending at 75
                </FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-muted-foreground cursor-help">
                      <Info className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Assumes you will spend 75% of your desired annual income from age 75 onwards
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
