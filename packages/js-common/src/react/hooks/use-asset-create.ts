import { apiRequest } from "../../api/transport";
import { portfolioGraphValues } from "../../api/queryKeys";
import { UserAsset, UserAssetOrphanInsert } from "../../schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from '../notifications/useNotifications';
import {
  portfolioAssets,
  portfolioGraphTransactions,
} from "../../api/queryKeys";

export const useAssetCreate = () => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  return useMutation<UserAsset, Error, UserAssetOrphanInsert>({
    mutationFn: (newAsset) =>
      apiRequest<UserAsset>("POST", "/api/assets/", newAsset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      notify({
        title: "Asset added",
        description: "Your asset has been added successfully.",
      });
    },
    onError: (error) => {
      console.error("Error adding asset", error);
      notify({
        title: "Error adding asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
