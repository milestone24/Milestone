import { assetFlatTransactions } from "../../api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import { AssetTransaction } from "../../schema";

type AssetContributionDelete = {
  contributionId: AssetTransaction["id"];
};

export const useAssetContributionDelete = (assetId: string) => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  return useMutation<void, Error, AssetContributionDelete>({
    mutationFn: ({ contributionId }) =>
      apiRequest(
        "DELETE",
        `/api/assets/${assetId}/contributions/${contributionId}`,
      ),
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
        title: "Contribution deleted",
        description: "Your contribution has been deleted successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error deleting contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
