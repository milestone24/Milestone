import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

type FireHeroHeaderProps = {
  projectedValue: number;
  projectedRetirementAge: number | null;
  targetRetirementAge: number;
};

export function FireHeroHeader({
  projectedValue,
  projectedRetirementAge,
  targetRetirementAge,
}: FireHeroHeaderProps) {
  const displayAge = projectedRetirementAge ?? targetRetirementAge;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Projected at retirement
      </p>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-foreground leading-none">
          {formatCurrency(projectedValue)}
        </span>
        <Badge variant="secondary" className="mb-0.5 rounded-full text-xs font-semibold">
          Age {displayAge}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Monthly delta: <span className="text-muted-foreground/60 italic">coming soon</span>
      </p>
    </div>
  );
}
