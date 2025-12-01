import { BsPiggyBank } from "react-icons/bs";
import { Button } from "@/components/ui/button";
import { Coins, Pencil, Trash2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  AssetTransaction,
  createDecimalValueString,
} from "@shared/schema";
import { TransactionsDialogue } from "./TransactionsDialogue";
import { usePortfolio } from "@/context/PortfolioContext";
import {
  RecurringContributionFormData,
  AssetContributionFormData,
  isSingleContributionFormData,
} from "@shared/schema/transaction";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogDescription,
  AlertDialogContent,
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useRecurringContributions } from "@/hooks/use-recurring-contributions";
import {
  RecurringContributionDialog,
  RecurringContributionTriggerButton,
} from "./RecurringContributionDialog";
import { RecurringContributionsList } from "./RecurringContributionsList";

type TransactionsPanelProps = {
  assetId: string;
};

export const TransactionsPanel = ({ assetId }: TransactionsPanelProps) => {
  const {
    addAssetContribution,
    updateAssetContribution,
    deleteAssetContribution,
  } = usePortfolio();

  // Query for asset contributions history
  const { data: contributions, isLoading: isContributionsLoading } = useQuery<
    AssetTransaction[]
  >({
    queryKey: ["asset", assetId, "contributions"],
    queryFn: () =>
      apiRequest<AssetTransaction[]>(
        "GET",
        `/api/assets/${assetId}/contributions`
      ),
  });

  // Query and mutations for recurring contributions (create only - edit/delete handled by items)
  const {
    recurringContributions,
    isLoading: isRecurringLoading,
    createRecurringContribution,
  } = useRecurringContributions(assetId);

  // State for single contribution dialog
  const [contributionDialogData, setContributionDialogData] = useState<
    | {
        data: AssetTransaction | null;
      }
    | undefined
  >(undefined);

  // State for create recurring contribution dialog
  const [isCreateRecurringOpen, setIsCreateRecurringOpen] = useState(false);

  // State for delete confirmation dialog (single contributions only)
  const [contributionToDelete, setContributionToDelete] = useState<
    string | null
  >(null);

  // Handlers for single contributions
  const handleCreateContribution = async (
    data: AssetContributionFormData
  ): Promise<AssetTransaction> => {
    if (!assetId) throw new Error("Asset ID is required");
    try {
      return addAssetContribution.mutateAsync({
        ...data,
        assetId: assetId,
        value:
          typeof data.value === "string"
            ? createDecimalValueString(data.value)
            : data.value,
        valueDate: data.valueDate,
      });
    } catch (error) {
      console.error("Error creating contribution:", error);
      throw error;
    }
  };

  const handleEditContribution = async (
    contributionId: string,
    data: AssetContributionFormData
  ): Promise<AssetTransaction> => {
    try {
      return updateAssetContribution.mutateAsync({
        ...data,
        contributionId: contributionId,
        assetId: assetId,
        value:
          typeof data.value === "string"
            ? createDecimalValueString(data.value)
            : data.value,
        valueDate: data.valueDate,
      });
    } catch (error) {
      console.error("Error updating contribution:", error);
      throw error;
    }
  };

  const handleDeleteContribution = async (contributionId: string) => {
    try {
      await deleteAssetContribution.mutateAsync({
        assetId: assetId,
        contributionId: contributionId,
      });
      setContributionToDelete(null);
    } catch (error) {
      console.error("Error deleting contribution:", error);
    }
  };

  // Handler for creating recurring contributions
  const handleCreateRecurringContribution = async (
    data: RecurringContributionFormData
  ) => {
    await createRecurringContribution.mutateAsync({
      ...data,
      type: "asset",
    });
    setIsCreateRecurringOpen(false);
  };

  // Combined handler for TransactionsDialogue (single contributions only)
  const handleContributionSubmit = async <
    T extends AssetContributionFormData | RecurringContributionFormData =
      | AssetContributionFormData
      | RecurringContributionFormData,
    R = T extends AssetContributionFormData
      ? AssetTransaction
      : never
  >(
    data: T,
    contributionId?: string
  ): Promise<R> => {
    if (isSingleContributionFormData(data)) {
      return contributionId
        ? ((await handleEditContribution(contributionId, data)) as R)
        : ((await handleCreateContribution(data)) as R);
    }
    throw new Error("Recurring contributions should use the dedicated dialog");
  };

  return (
    <div>
      {/* Contribution Summary Section */}
      {contributions && contributions.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-2 flex items-center">
            <BsPiggyBank className="h-5 w-5 mr-2 text-green-600" />
            Contribution Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-sm text-gray-600">Total Contributed</p>
              <p className="text-xl font-semibold">
                £
                {contributions
                  .reduce((sum, item) => sum + Number(item.value), 0)
                  .toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Number of Contributions</p>
              <p className="text-xl font-semibold">{contributions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">First Contribution</p>
              <p className="text-base font-medium">
                {contributions.length > 0
                  ? new Date(
                      Math.min(
                        ...contributions.map((c) =>
                          new Date(c.recordedAt).getTime()
                        )
                      )
                    ).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Contribution</p>
              <p className="text-base font-medium">
                {contributions.length > 0
                  ? new Date(
                      Math.max(
                        ...contributions.map((c) =>
                          new Date(c.recordedAt).getTime()
                        )
                      )
                    ).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h2 className="text-lg font-medium">Contributions</h2>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <RecurringContributionTriggerButton
            onClick={() => setIsCreateRecurringOpen(true)}
          />
          <Button
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={() => setContributionDialogData({ data: null })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contribution
          </Button>
        </div>
      </div>

      {/* Create Recurring Contribution Dialog */}
      <RecurringContributionDialog
        isOpen={isCreateRecurringOpen}
        onOpenChange={setIsCreateRecurringOpen}
        onSubmit={handleCreateRecurringContribution}
        data={null}
      />

      {/* Recurring Contributions List - each item handles its own edit/delete */}
      <RecurringContributionsList
        contributions={recurringContributions}
        assetId={assetId}
        isLoading={isRecurringLoading}
      />

      {/* Single Contributions List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Contribution History
        </h3>
        {contributions?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No contributions recorded for this account.
          </div>
        )}
        {contributions?.map((contribution) => (
          <div
            key={contribution.id}
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <Coins className="h-4 w-4 text-green-600" />
                <span className="font-semibold">
                  £{Number(contribution.value).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(contribution.recordedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setContributionDialogData({
                    data: contribution,
                  });
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setContributionToDelete(contribution.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Single Contribution Dialog */}
      <TransactionsDialogue
        onOpenChange={(open) => {
          setContributionDialogData(open ? { data: null } : undefined);
        }}
        {...(contributionDialogData
          ? {
              isOpen: true,
              onSubmit: handleContributionSubmit,
              data: contributionDialogData.data,
            }
          : {
              isOpen: false,
            })}
      />

      {/* Delete Single Contribution Confirmation Dialog */}
      <AlertDialog
        open={!!contributionToDelete}
        onOpenChange={() => setContributionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contribution</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contribution record? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {contributionToDelete ? (
              <AlertDialogAction
                onClick={() => handleDeleteContribution(contributionToDelete)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
