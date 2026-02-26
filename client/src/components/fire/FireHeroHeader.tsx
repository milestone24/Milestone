const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

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
  const displayAge = targetRetirementAge;

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
        <span className="rounded-full bg-primary/20 text-primary px-3 py-0.5 text-xs font-medium">
          +£— this month
        </span>
      </div>
    </div>
  );
}
