import { cn } from "@/lib/utils";

export function PosNegNumber({
  value,
  displayInPercentage = false,
  minimumFractionDigits = 2,
  className,
}: {
  value: number | null;
  displayInPercentage?: boolean;
  minimumFractionDigits?: number;
  className?: string;
}) {
  const defaultClassName = "text-sm text-muted-foreground";

  const classNameToApply = cn(
    defaultClassName,
    value !== null
      ? value > 0
        ? "text-green-600"
        : value < 0
        ? "text-red-600"
        : "text-muted-foreground"
      : "text-muted-foreground",
    className
  );

  return (
    <>
      {value !== null ? (
        <span className={classNameToApply}>
          {value > 0 ? "+" : value < 0 ? "" : ""}
          {Intl.NumberFormat("en-GB", {
            style: displayInPercentage ? "percent" : "currency",
            currency: displayInPercentage ? undefined : "GBP",
            minimumFractionDigits: minimumFractionDigits,
          }).format(value)}
        </span>
      ) : (
        <span className={classNameToApply}>—</span>
      )}
    </>
  );
}
