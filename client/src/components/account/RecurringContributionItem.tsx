import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Pause, Play, Loader2 } from "lucide-react";
import type { RecurringContribution } from "@shared/schema";
import { formatRRuleSchedule } from "@shared/utils/rrule-format";
import { useRecurringContributions } from "@/hooks/use-recurring-contributions";
import { RecurringContributionDialog } from "./RecurringContributionDialog";
import { DeleteRecurringContributionDialog } from "./DeleteRecurringContributionDialog";
import type { RecurringContributionFormData } from "@shared/schema/transaction";
import { cn } from "@/lib/utils";

type RecurringContributionItemProps = {
  contribution: RecurringContribution;
  assetId: string;
};

export const RecurringContributionItem = ({
  contribution,
  assetId,
}: RecurringContributionItemProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { updateRecurringContribution, deleteRecurringContribution } =
    useRecurringContributions(assetId);

  const handleEdit = async (data: RecurringContributionFormData) => {
    // Build the update payload based on contribution type
    const updatePayload =
      contribution.type === "security"
        ? {
            ...data,
            type: "security" as const,
            securityId: contribution.securityId!,
            contributionId: contribution.id,
          }
        : {
            ...data,
            type: "asset" as const,
            contributionId: contribution.id,
          };

    await updateRecurringContribution.mutateAsync(updatePayload);
    setIsEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteRecurringContribution.mutateAsync({
      contributionId: contribution.id,
    });
    setIsDeleteOpen(false);
  };

  const isDeleting = deleteRecurringContribution.isPending;
  const isUpdating = updateRecurringContribution.isPending;
  const isBusy = isDeleting || isUpdating;

  return (
    <>
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-gray-50 rounded-lg transition-opacity",
          isBusy && "opacity-50 pointer-events-none"
        )}
      >
        {/* Content Section */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-lg">
              £{Number(contribution.amount).toLocaleString()}
            </span>
            {isBusy && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
            <Badge
              variant={contribution.isActive ? "default" : "secondary"}
              className={
                contribution.isActive
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : "bg-gray-100 text-gray-600"
              }
            >
              {contribution.isActive ? (
                <Play className="h-3 w-3 mr-1" />
              ) : (
                <Pause className="h-3 w-3 mr-1" />
              )}
              {contribution.isActive ? "Active" : "Paused"}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground truncate">
            {formatRRuleSchedule(contribution.patternConfig)}
          </span>
          {contribution.process === "automatic" && (
            <span className="text-xs text-blue-600">
              Auto-processing enabled
            </span>
          )}
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsEditOpen(true)}
            disabled={isBusy}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isBusy}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <RecurringContributionDialog
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleEdit}
        data={contribution}
      />

      {/* Delete Confirmation */}
      <DeleteRecurringContributionDialog
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        isDeleting={deleteRecurringContribution.isPending}
      />
    </>
  );
};

