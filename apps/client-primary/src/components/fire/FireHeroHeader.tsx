import Decimal from "decimal.js";
import type { DecimalValueString } from "@milestone/js-common/schema";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

const formatMoMBadge = (delta: number): string => {
  const abs = Math.abs(delta);
  const prefix = delta >= 0 ? "+" : "-";
  return `${prefix}${formatCurrency(abs)} this month`;
};

type FireHeroHeaderProps = {
  projectedValue: number;
  projectedRetirementAge: number | null;
  targetRetirementAge: number;
  projectedRetirementValueDelta?: DecimalValueString | null;
};

export function FireHeroHeader({
  projectedValue,
  projectedRetirementAge,
  targetRetirementAge,
  projectedRetirementValueDelta,
}: FireHeroHeaderProps) {
  const displayAge = targetRetirementAge;

  const momValue =
    projectedRetirementValueDelta == null
      ? null
      : Decimal(projectedRetirementValueDelta).toNumber();

  const badgeText = momValue === null ? "— this month" : formatMoMBadge(momValue);

  const badgeClass =
    momValue === null
      ? "bg-primary/20 text-primary"
      : momValue >= 0
        ? "bg-positive/20 text-positive"
        : "bg-negative/20 text-negative";

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">Projected at retirement</p>
      <span className="text-5xl font-bold text-foreground leading-tight">
        {formatCurrency(projectedValue)}
      </span>
      <div className="flex items-center gap-3 mt-0.5">
        <span className="text-sm text-muted-foreground">
          By age {displayAge}
        </span>
        <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${badgeClass}`}>
          {badgeText}
        </span>
      </div>
    </div>
  );
}
