import { assetFlatTransactions } from "../../api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import {
  AssetTransaction,
  AssetContributionInsert,
} from "../../schema";

type AssetContributionUpdate = AssetContributionInsert & {
  contributionId: AssetTransaction["id"];
};

export const useAssetContributionUpdate = (assetId: string) => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  return useMutation<AssetTransaction, Error, AssetContributionUpdate>({
    mutationFn: (data) => {
      const { assetId: _assetId, contributionId, ...rest } = data;
      return apiRequest<AssetTransaction>(
        "PUT",
        `/api/assets/${assetId}/contributions/${contributionId}`,
        { ...rest },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["asset", assetId, "contributions"],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetFlatTransactions, assetId],
      });
      notify({
        title: "Contribution updated",
        description: "Your contribution has been updated successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error updating contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
