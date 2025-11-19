import { cn } from "@/lib/utils";

export function PosNegNumber({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  const defaultClassName = "text-sm text-muted-foreground";

  const classNameToApply = cn(
    defaultClassName,
    value !== null
      ? value > 0
        ? "text-green-500"
        : "text-red-500"
      : "text-muted-foreground",
    className
  );

  return (
    <>
      {value !== null ? (
        <span className={classNameToApply}>
          {value > 0 ? "+" : ""}
          {Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(value)}
        </span>
      ) : (
        <span className={classNameToApply}>—</span>
      )}
    </>
  );
}
