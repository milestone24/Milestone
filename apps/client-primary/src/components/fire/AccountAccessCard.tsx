import { Check, Lock, Trash2, CircleCheck, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AccountAccessTimelineEntry,
  Contributor,
} from "@milestone/js-common/schema/projections";
import { Input } from "../ui/input";
import {
  montlyScheduleWithValue,
  singleMonthlyContributorAmount,
} from "@milestone/js-common/utils/contributor";
import { Button } from "../ui/button";

type AccountAccessCardProps = {
  entry: AccountAccessTimelineEntry;
  onUpdateContributor: (
    id: string,
    updates: Partial<Omit<Contributor, "id">>,
  ) => void;
  onRemoveContributor: (id: string) => void;
};

const formatCurrency = (value: string | number) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(numValue);
};

export function AccountAccessCard({
  entry,
  onUpdateContributor,
  onRemoveContributor,
}: AccountAccessCardProps) {
  const {
    isAccessible,
    contributorName,
    accountType,
    taxCharacteristics,
    age,
    projectedValue,
    type,
  } = entry;

  // const monthly =
  //   type === "adjustment" ? singleMonthlyContributorAmount(entry) : 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isAccessible
          ? "border-green-200 bg-green-50"
          : "border-muted bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {contributorName
                ? `${contributorName} - ${accountType} (${type})`
                : accountType}
            </span>
            <span className="text-sm text-muted-foreground">
              {isAccessible ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" /> Available Now
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <Lock className="h-4 w-4" /> Locked until {age}
                </span>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {taxCharacteristics}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-semibold">
            {formatCurrency(projectedValue)}
          </span>
        </div>
        {type === "adjustment" ? (
          <div className="flex items-center gap-2">
            {/* <Input
              className="w-24 h-8 text-sm"
              type="number"
              min={0}
              //TODO is this correct?
              value={projectedValue}
              onChange={(e) =>
                onUpdateContributor(entry.contributorId, {
                  schedules: [
                    montlyScheduleWithValue(Number(e.target.value ?? 0)),
                  ],
                })
              }
            /> */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveContributor(entry.contributorId)}
              title="Click to remove adjustment contributor"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        {type === "asset" || type === "state_pension" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={
              () => undefined
              //TODO
              //togglePortfolioExcluded(entry.referenceId)
            }
            title="Click to exclude from contrinutors"
          >
            <CircleCheck className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
