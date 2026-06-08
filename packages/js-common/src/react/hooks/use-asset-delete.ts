import { apiRequest } from "../../api/transport";
import {
  portfolioAssets,
  portfolioGraphValues,
  portfolioGraphTransactions,
} from "../../api/queryKeys";
import { UserAsset } from "../../schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from '../notifications/useNotifications';

export const useAssetDelete = () => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  return useMutation<void, Error, UserAsset["id"]>({
    mutationFn: (id) => apiRequest<void>("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      notify({
        title: "Asset deleted",
        description: "Your asset has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error("Error deleting asset", error);
      notify({
        title: "Error deleting asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
