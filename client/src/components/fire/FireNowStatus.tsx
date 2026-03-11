import { Card, CardContent } from "@/components/ui/card";
import type { DecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";

type FireNowStatusProps = {
  currentPortfolioValue: DecimalValueString;
  fireNumber: DecimalValueString;
  desiredAnnualIncome: DecimalValueString;
  projectedPortfolioValueAtRetirement: DecimalValueString;
  safeWithdrawalRate: DecimalValueString;
  monthOverMonthDelta?: DecimalValueString | null;
};

const formatGBP0 = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

const formatMoMDelta = (delta: number): string => {
  const abs = Math.abs(delta);
  const prefix = delta >= 0 ? "↑" : "↓";
  return `${prefix} ${formatGBP0(abs)} vs last month`;
};

const formatSurplus = (delta: number): string => {
  const abs = Math.abs(delta);
  const prefix = delta >= 0 ? "↑" : "↓";
  const label = delta >= 0 ? "surplus" : "shortfall";
  return `${prefix} ${formatGBP0(abs)} ${label}`;
};

export function FireNowStatus({
  currentPortfolioValue,
  fireNumber,
  desiredAnnualIncome,
  projectedPortfolioValueAtRetirement,
  safeWithdrawalRate,
  monthOverMonthDelta,
}: FireNowStatusProps) {
  const currentPortfolio = Decimal(currentPortfolioValue).toNumber();
  const fireNumberValue = Decimal(fireNumber).toNumber();
  const desiredIncome = Decimal(desiredAnnualIncome).toNumber();

  const projectedAtRetirement = Decimal(projectedPortfolioValueAtRetirement).toNumber();
  const swr = Decimal(safeWithdrawalRate).div(100).toNumber();
  const estimatedIncome = projectedAtRetirement * swr;
  const incomeDelta = estimatedIncome - desiredIncome;

  const momDeltaText =
    monthOverMonthDelta === undefined
      ? "↑ — vs last month"
      : monthOverMonthDelta === null
        ? "↑ — vs last month"
        : formatMoMDelta(Decimal(monthOverMonthDelta).toNumber());

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="rounded-3xl border-border/40 bg-card/95 shadow-sm">
        <CardContent className="px-6 py-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current Portfolio
          </div>
          <div className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[36px]">
            {formatGBP0(currentPortfolio)}
          </div>
          <div className="mt-2 text-sm font-medium text-emerald-400">
            {momDeltaText}
          </div>
          {monthOverMonthDelta === undefined ? (
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
              TODO: MoM delta is defined as (today - end of last month). We are
              intentionally not fetching extra server data on the FIRE page; add
              this to the initial FIRE payload later.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/40 bg-card/95 shadow-sm">
        <CardContent className="px-6 py-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            FIRE Number
          </div>
          <div className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[36px]">
            {formatGBP0(fireNumberValue)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Your portfolio goal</div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/40 bg-card/95 shadow-sm">
        <CardContent className="px-6 py-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estimated Income
          </div>
          <div className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[36px]">
            {formatGBP0(estimatedIncome)}
          </div>
          <div
            className={`mt-2 text-sm font-medium ${
              incomeDelta >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {formatSurplus(incomeDelta)}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/40 bg-card/95 shadow-sm">
        <CardContent className="px-6 py-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Desired Income
          </div>
          <div className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[36px]">
            {formatGBP0(desiredIncome)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Your income goal</div>
        </CardContent>
      </Card>
    </div>
  );
}

