import { assetFlatTransactions } from "../../api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import { AssetTransaction, AssetContributionInsert } from "../../schema";

export const useAssetContributionCreate = (assetId: string) => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  return useMutation<AssetTransaction, Error, AssetContributionInsert>({
    mutationFn: (data: AssetContributionInsert) => {
      const { assetId: _assetId, ...rest } = data;
      return apiRequest<AssetTransaction>(
        "POST",
        `/api/assets/${assetId}/contributions`,
        {
          ...rest,
          recordedAt: new Date(),
        },
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
        title: "Contribution recorded",
        description: "Your contribution has been recorded successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error recording contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
