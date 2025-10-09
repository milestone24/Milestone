import { BsPiggyBank } from "react-icons/bs";
import { Button } from "@/components/ui/button";
import { Coins, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  AssetTransaction,
  RecurringContribution,
  RecurringContributionInsert,
} from "@shared/schema";
import { TransactionsDialogue } from "./TransactionsDialogue";
import { usePortfolio } from "@/context/PortfolioContext";
import {
  RecurringContributionFormData,
  SingleContributionFormData,
  isSingleContributionFormData,
} from "@shared/schema/contribution";
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

  // // Query for recurring contributions
  // TODO: Add recurring contributions
  // const { data: recurringContributionsData, isLoading: isRecurringLoading } =
  //   useQuery<RecurringContribution[]>({
  //     queryKey: ["broker-asset-recurring-contributions", assetId],
  //     queryFn: () =>
  //       apiRequest<RecurringContribution[]>(
  //         "GET",
  //         `/api/assets/broker/${assetId}/recurring-contributions`
  //       ),
  //     enabled: !!assetId,
  //   });

  // Mutations for recurring contributions
  const addRecurringContribution = useMutation<
    RecurringContribution,
    Error,
    RecurringContributionInsert
  >({
    mutationFn: (data: RecurringContributionInsert) =>
      apiRequest<RecurringContribution>(
        "POST",
        `/api/assets/${assetId}/recurring-contributions`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["broker-asset-recurring-contributions", assetId],
      });
    },
  });

  const updateRecurringContribution = useMutation<
    RecurringContribution,
    Error,
    RecurringContributionInsert & { contributionId: string }
  >({
    mutationFn: (
      data: RecurringContributionInsert & { contributionId: string }
    ) =>
      apiRequest(
        "PUT",
        `/api/assets/${assetId}/recurring-contributions/${data.contributionId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["broker-asset-recurring-contributions", assetId],
      });
    },
  });

  const deleteRecurringContribution = useMutation<
    RecurringContribution,
    Error,
    { assetId: string; contributionId: string }
  >({
    mutationFn: (data: { assetId: string; contributionId: string }) =>
      apiRequest(
        "DELETE",
        `/api/assets/broker/${data.assetId}/recurring-contributions/${data.contributionId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["broker-asset-recurring-contributions", assetId],
      });
    },
  });
  // State for contributions t
  const [contributionToDelete, setContributionToDelete] = useState<
    string | null
  >(null);

  const [contributionDialogData, setContributionDialogData] = useState<
    | {
        data: AssetTransaction | RecurringContribution | null;
      }
    | undefined
  >(undefined);

  // Handlers for contributions
  const handleCreateContribution = async (
    data: SingleContributionFormData
  ): Promise<AssetTransaction> => {
    if (!assetId) throw new Error("Asset ID is required");
    try {
      return addAssetContribution.mutateAsync({
        ...data,
        assetId: assetId,
        valueDate: data.valueDate,
      });
    } catch (error) {
      console.error("Error creating contribution:", error);
      throw error;
    }
  };

  const handleEditContribution = async (
    contributionId: string,
    data: SingleContributionFormData
  ): Promise<AssetTransaction> => {
    try {
      return updateAssetContribution.mutateAsync({
        ...data,
        contributionId: contributionId,
        assetId: assetId,
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
    } catch (error) {
      console.error("Error deleting contribution:", error);
    }
  };

  // Handlers for recurring contributions
  const handleCreateRecurringContribution = async (
    data: RecurringContributionFormData
  ) => {
    if (!assetId) return;

    try {
      await addRecurringContribution.mutateAsync({
        assetId: assetId,
        ...data,
      });
    } catch (error) {
      console.error("Error creating recurring contribution:", error);
      throw error;
    }
  };

  const handleEditRecurringContribution = async (
    contributionId: string,
    data: RecurringContributionFormData
  ) => {
    try {
      return updateRecurringContribution.mutateAsync({
        assetId: assetId,
        ...data,
        contributionId: contributionId,
      });
    } catch (error) {
      console.error("Error updating recurring contribution:", error);
    }
  };

  const handleContributionSubmit = async <
    T extends SingleContributionFormData | RecurringContributionFormData =
      | SingleContributionFormData
      | RecurringContributionFormData,
    R = T extends SingleContributionFormData
      ? AssetTransaction
      : T extends RecurringContributionFormData
      ? RecurringContribution
      : never
  >(
    data: T,
    contributionId?: string
  ): Promise<R> => {
    if (isSingleContributionFormData(data)) {
      return contributionId
        ? ((await handleEditContribution(contributionId, data)) as R)
        : ((await handleCreateContribution(data)) as R);
    } else {
      return contributionId
        ? ((await handleEditRecurringContribution(contributionId, data)) as R)
        : ((await handleCreateRecurringContribution(data)) as R);
    }
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
          <div className="grid grid-cols-2 gap-4 mt-3">
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

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Contributions</h2>
        <TransactionsDialogue
          onOpenChange={(open) => {
            setContributionDialogData((prev) =>
              open ? { data: null } : undefined
            );
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
      </div>

      {/* Contributions List */}
      <div className="space-y-4">
        {contributions?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No contributions recorded for this account.
          </div>
        )}
        {contributions?.map((contribution) => (
          <div
            key={contribution.id}
            className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
          >
            <div>
              <div className="flex items-center">
                <Coins className="h-4 w-4 mr-1 text-green-600" />
                <p className="font-medium">
                  £{Number(contribution.value).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(contribution.recordedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
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
                variant="outline"
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

      {/* Delete Contribution Confirmation Dialog */}
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
