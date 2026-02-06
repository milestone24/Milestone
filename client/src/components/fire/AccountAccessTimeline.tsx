import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountAccessTimelineEntry } from "@shared/schema/projections";

type AccountAccessTimelineProps = {
  entries: AccountAccessTimelineEntry[];
};

export function AccountAccessTimeline({ entries }: AccountAccessTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No account access information available.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto py-4">
      {entries.map((entry, index) => (
        <div
          key={`${entry.contributorName}-${index}`}
          className="flex flex-col items-center gap-2 min-w-[80px]"
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border-2",
              entry.isAccessible
                ? "border-green-500 bg-green-100 text-green-600"
                : "border-amber-500 bg-amber-100 text-amber-600"
            )}
          >
            {entry.isAccessible ? (
              <Check className="h-6 w-6" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {entry.age === null ? "Now" : `Age ${entry.age}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.contributorName}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
