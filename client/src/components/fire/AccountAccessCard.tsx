import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountAccessTimelineEntry } from "@shared/schema/projections";

type AccountAccessCardProps = {
  entry: AccountAccessTimelineEntry;
};

const formatCurrency = (value: string | number) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(numValue);
};

export function AccountAccessCard({ entry }: AccountAccessCardProps) {
  const isAccessible = entry.isAccessible;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isAccessible
          ? "border-green-200 bg-green-50"
          : "border-muted bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{entry.accountType}</span>
            <span className="text-sm text-muted-foreground">
              {isAccessible ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" /> Available Now
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <Lock className="h-4 w-4" /> Locked until {entry.age}
                </span>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {entry.taxCharacteristics}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-semibold">
            {formatCurrency(entry.projectedValue)}
          </span>
        </div>
      </div>
    </div>
  );
}
