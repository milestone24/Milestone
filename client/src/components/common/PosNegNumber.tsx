import { cn } from "@/lib/utils";

export function PosNegNumber({
  value,
  displayInPercentage = false,
  className,
}: {
  value: number | null;
  displayInPercentage?: boolean;
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

  console.log("value", value);
  console.log("displayInPercentage", displayInPercentage);

  return (
    <>
      {value !== null ? (
        <span className={classNameToApply}>
          {value > 0 ? "+" : value < 0 ? "" : ""}
          {Intl.NumberFormat("en-GB", {
            style: displayInPercentage ? "percent" : "currency",
            currency: displayInPercentage ? undefined : "GBP",
            minimumFractionDigits: displayInPercentage ? 1 : undefined,
          }).format(value)}
        </span>
      ) : (
        <span className={classNameToApply}>—</span>
      )}
    </>
  );
}
