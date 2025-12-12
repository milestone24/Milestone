import { CalendarClock } from "lucide-react";
import type { RecurringContribution } from "@shared/schema";
import { RecurringContributionItem } from "./RecurringContributionItem";

type RecurringContributionsListProps = {
  contributions: RecurringContribution[];
  assetId: string;
  isLoading?: boolean;
};

export const RecurringContributionsList = ({
  contributions,
  assetId,
  isLoading,
}: RecurringContributionsListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-lg animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <CalendarClock className="h-4 w-4" />
        Recurring Contributions
      </h3>
      {!contributions || contributions.length === 0 ? (
        <div className=" text-gray-500">
          <p>No recurring contributions recorded for this account.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contributions.map((contribution) => (
            <RecurringContributionItem
              key={contribution.id}
              contribution={contribution}
              assetId={assetId}
            />
          ))}
        </div>
      )}
    </div>
  );
};
