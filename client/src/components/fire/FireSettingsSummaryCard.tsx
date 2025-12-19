import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { UseFormReturn } from "react-hook-form";
import type { FireSettingsInsert } from "@shared/schema";
import { FireSettingsPanel } from "@/components/fire/FireSettingsPanel";

import type { FireSettingsFormValues } from "@/components/fire/FireSettingsForm";

type FireSettingsSummaryCardProps = {
  form: UseFormReturn<FireSettingsFormValues>;
  onSubmit: ReturnType<UseFormReturn<FireSettingsFormValues>["handleSubmit"]>;
  isSubmitting: boolean;
  isDirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPreviewModifiers?: () => void;
};

const formatCurrency = (value: string | number | null | undefined) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "—";
  }
  return `£${numeric.toLocaleString()}`;
};

const formatPercentage = (value: string | number | null | undefined) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return `${numeric}%`;
};

const formatAge = (value: string | number | null | undefined) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "—";
  }
  return `${numeric} yrs`;
};

export function FireSettingsSummaryCard({
  form,
  onSubmit,
  isSubmitting,
  isDirty,
  open,
  onOpenChange,
  onOpenPreviewModifiers,
}: FireSettingsSummaryCardProps) {
  const [
    annualIncomeGoal,
    expectedAnnualReturn,
    safeWithdrawalRate,
    monthlyInvestment,
    targetRetirementAge,
    includeStatePension,
    reduceSpendingAt75,
  ] = form.watch([
    "annualIncomeGoal",
    "expectedAnnualReturn",
    "safeWithdrawalRate",
    "monthlyInvestment",
    "targetRetirementAge",
    "includeStatePension",
    "reduceSpendingAt75",
  ]);

  const summaryRows = useMemo(
    () => [
      {
        label: "Annual income goal",
        value: formatCurrency(annualIncomeGoal),
      },
      {
        label: "Expected annual return",
        value: formatPercentage(expectedAnnualReturn),
      },
      {
        label: "Safe withdrawal rate",
        value: formatPercentage(safeWithdrawalRate),
      },
      {
        label: "Monthly investment",
        value: formatCurrency(monthlyInvestment),
      },
      {
        label: "Target retirement age",
        value: formatAge(targetRetirementAge),
      },
      {
        label: "Include state pension",
        value: includeStatePension ? "Yes" : "No",
      },
      {
        label: "Reduce spending at 75",
        value: reduceSpendingAt75 ? "Yes" : "No",
      },
    ],
    [
      annualIncomeGoal,
      expectedAnnualReturn,
      monthlyInvestment,
      safeWithdrawalRate,
      targetRetirementAge,
      includeStatePension,
      reduceSpendingAt75,
    ]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium">
              FIRE settings
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Review the configuration that powers your retirement projection.
            </p>
          </div>
          {isDirty && <Badge variant="secondary">Draft changes</Badge>}
        </div>
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Changes are saved per user. Unsaved updates remain in draft until you
          apply them.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {summaryRows.map((row) => (
            <div
              key={row.label}
              className="rounded-md border bg-muted/30 px-3 py-2"
            >
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {row.label}
              </dt>
              <dd className="text-sm font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onOpenChange(!open)}>
            {open ? "Close editor" : "Edit settings"}
          </Button>
          {onOpenPreviewModifiers && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenPreviewModifiers}
            >
              Adjust preview
            </Button>
          )}
        </div>

        <Collapsible open={open} onOpenChange={onOpenChange}>
          <CollapsibleContent className="space-y-4 data-[state=closed]:hidden">
            <div className="rounded-lg border bg-background p-4">
              <FireSettingsPanel
                form={form}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

