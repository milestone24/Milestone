import type { FireHeroLegendValues } from "@/hooks/use-fire-hero-chart";

// Maps account type key to its Tailwind CSS token class
const ACCOUNT_TYPE_COLOR_CLASS: Record<string, string> = {
  ISA: "bg-isa",
  SIPP: "bg-sipp",
  LISA: "bg-lisa",
  GIA: "bg-gia",
  OTHER: "bg-other",
  PENSION: "bg-pension",
};

const FALLBACK_COLOR_CLASS = "bg-primary";

const getColorClass = (accountType: string): string =>
  ACCOUNT_TYPE_COLOR_CLASS[accountType.toUpperCase()] ?? FALLBACK_COLOR_CLASS;

const formatCurrencyAbbreviated = (value: number): string => {
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (value >= 1_000) {
    return `£${(value / 1_000).toFixed(0)}k`;
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
};

type FireHeroLegendProps = {
  legendValues: FireHeroLegendValues;
};

export function FireHeroLegend({ legendValues }: FireHeroLegendProps) {
  const { perType, total } = legendValues;

  if (perType.size === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
      {[...perType.entries()].map(([accountType, value]) => (
        <LegendItem
          key={accountType}
          accountType={accountType}
          value={value}
        />
      ))}
      <div className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground font-normal">Total</span>
        {formatCurrencyAbbreviated(total)}
      </div>
    </div>
  );
}

type LegendItemProps = {
  accountType: string;
  value: number;
};

function LegendItem({ accountType, value }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-[3px] shrink-0 ${getColorClass(accountType)}`} />
      <span className="text-xs text-muted-foreground">{accountType}</span>
      <span className="text-xs font-medium text-foreground">
        {formatCurrencyAbbreviated(value)}
      </span>
    </div>
  );
}
