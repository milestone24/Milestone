import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { UserAsset, UserAssetUpdate, UserAssetWithValueChange } from "../../schema";
import { useNotifications } from '../notifications/useNotifications';
import { asset as assetQueryKey, portfolioAssets, portfolioGraphTransactions, portfolioGraphValues, assetSecuritiesTransactions, assetSecurities } from "../../api/queryKeys";

export const useAssetUpdate = (assetId: string) => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  return useMutation<UserAsset, Error, UserAssetUpdate>({
    mutationFn: (data) => {
      console.log("PATCH data", JSON.stringify(data, null, 2));
      return apiRequest<UserAsset>("PATCH", `/api/assets/${assetId}`, {
        ...data,
      });
    },
    onMutate: async (updatedAsset) => {
      await queryClient.cancelQueries({ queryKey: portfolioAssets });
      const previous = queryClient.getQueryData<UserAssetWithValueChange[]>(portfolioAssets);
      if (previous) {
        queryClient.setQueryData<UserAssetWithValueChange[]>(
          portfolioAssets,
          previous.map((a) => (a.id === assetId ? { ...a, ...updatedAsset } : a))
        );
      }
      return { previous };
    },
    onError: (_error, _updatedAsset, context) => {
      const ctx = context as { previous?: UserAssetWithValueChange[] } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(portfolioAssets, ctx.previous);
      }
      notify({
        title: "Error updating asset",
        description:
          _error instanceof Error ? _error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: [...assetQueryKey, assetId] });
      queryClient.invalidateQueries({ queryKey: [...assetSecurities, assetId] });
      queryClient.invalidateQueries({ queryKey: [...assetSecuritiesTransactions, assetId] });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      notify({
        title: "Asset updated",
        description: "Your asset has been updated successfully.",
      });
    },
  });
}