import { Button } from "@/components/ui/button";
import { ChartLine } from "lucide-react";
import Decimal from "decimal.js";
import type { FireOverviewCardProps } from "./FireOverviewCard";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number | null) =>
  value !== null
    ? Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(value)
    : "—";

export function FireOverviewStickyBar({
  targetRetirementAge,
  valueAtRetirement,
  fireNumber,
  showChart,
  onToggleChart,
  currentPortfolioValue,
  progressPercentage,
  yearsToFire,
}: Pick<
  FireOverviewCardProps,
  | "targetRetirementAge"
  | "valueAtRetirement"
  | "fireNumber"
  | "showChart"
  | "onToggleChart"
  | "currentPortfolioValue"
  | "progressPercentage"
  | "yearsToFire"
>) {
  const valueNum =
    valueAtRetirement != null ? Number(valueAtRetirement) : null;
  const fireNum =
    fireNumber != null ? Decimal(fireNumber).toNumber() : null;
  const progressNum =
    progressPercentage != null
      ? Decimal(progressPercentage).toNumber()
      : null;
  const portfolioNum =
    currentPortfolioValue != null
      ? Decimal(currentPortfolioValue).toNumber()
      : null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-10 w-full border-b bg-background/95 px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
      )}
      role="region"
      aria-label="FIRE overview summary"
    >
      <div className="fire-screen mx-auto flex max-w-5xl items-center gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-muted-foreground">
            Projected @ {targetRetirementAge ?? "—"}
          </span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(valueNum)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium text-muted-foreground">FIRE #</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(fireNum)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium text-muted-foreground">Progress</span>
          <span className="font-semibold tabular-nums">
            {progressNum != null ? `${progressNum}%` : "—"}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium text-muted-foreground">Portfolio</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(portfolioNum)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium text-muted-foreground">Years to FIRE</span>
          <span className="font-semibold tabular-nums">
            {yearsToFire != null ? yearsToFire : "—"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-full",
            showChart ? "bg-muted" : "bg-transparent"
          )}
          onClick={onToggleChart}
          aria-label={showChart ? "Hide chart" : "Show chart"}
        >
          <ChartLine className="h-4 w-4" strokeWidth={1} />
        </Button>
      </div>
    </div>
  );
}
