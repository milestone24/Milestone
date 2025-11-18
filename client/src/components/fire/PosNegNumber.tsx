import { cn } from "@/lib/utils";

export function PosNegNumber({ value }: { value: number | null }) {
  return (
    <>
      {value !== null ? (
        <span
          className={cn(
            "text-sm text-muted-foreground block",
            value > 0 ? "text-green-500" : "text-red-500"
          )}
        >
          {value > 0 ? "+" : ""}
          {Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(value)}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground block">—</span>
      )}
    </>
  );
}
