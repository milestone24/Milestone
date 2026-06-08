import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type FireAssumptionsProps = {
  annualIncomeGoal: string;
  targetRetirementAge: number;
  safeWithdrawalRate: string;
  adjustInflation: boolean;
  includeStatePension: boolean;
  reduceSpendingAt75: boolean;
  onEditSettings: () => void;
};

export function FireAssumptions({
  annualIncomeGoal,
  targetRetirementAge,
  safeWithdrawalRate,
  adjustInflation,
  includeStatePension,
  reduceSpendingAt75,
  onEditSettings,
}: FireAssumptionsProps) {
  const incomeNumber = Number(annualIncomeGoal ?? "0");
  const safeIncome = Number.isFinite(incomeNumber) ? incomeNumber : 0;

  const ruleNumber = Number(safeWithdrawalRate ?? "0");
  const safeRule = Number.isFinite(ruleNumber) ? ruleNumber : 0;

  const formattedIncomeGoal =
    safeIncome > 0
      ? `${formatGBPFull(safeIncome)}/yr`
      : "—";

  const formattedRule =
    safeRule > 0 ? `${safeRule.toString().replace(/\.0+$/, "")}%` : "—";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Your assumptions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 text-sm sm:grid-cols-3 border-y border-border/60 bg-muted/10">
          <AssumptionColumn
            label="Income Goal"
            value={formattedIncomeGoal}
          />
          <AssumptionColumn
            label="Target Age"
            value={
              Number.isFinite(targetRetirementAge) && targetRetirementAge > 0
                ? targetRetirementAge.toString()
                : "—"
            }
          />
          <AssumptionColumn label="Rule" value={formattedRule} />
        </div>

        <div className="flex flex-wrap gap-2 pt-3">
          <AssumptionPill label="Adjust for inflation" active={adjustInflation} />
          <AssumptionPill label="State Pension" active={includeStatePension} />
          <AssumptionPill
            label="Reduced spending at 75"
            active={reduceSpendingAt75}
          />
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center border border-border/70 bg-muted/5 text-sm font-medium"
            onClick={onEditSettings}
          >
            Edit settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type AssumptionColumnProps = {
  label: string;
  value: string;
};

function AssumptionColumn({ label, value }: AssumptionColumnProps) {
  return (
    <div className="flex flex-col px-4 py-3 first:border-b-0 sm:border-x border-border/40">
      <span className="text-xs font-medium text-muted-foreground/90">
        {label}
      </span>
      <span className="mt-1 text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

type AssumptionPillProps = {
  label: string;
  active: boolean;
};

function AssumptionPill({ label, active }: AssumptionPillProps) {
  return (
    <span
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 bg-muted/20 text-muted-foreground",
      )}
    >
      {active ? <Check className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatGBPFull(value: number): string {
  if (!Number.isFinite(value)) return "£0";
  return gbpFormatter.format(value);
}


