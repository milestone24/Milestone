import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  portfolioAssets,
  portfolioGraphValues,
  portfolioGraphTransactions,
} from "@shared/api/queryKeys";
import { UserAsset } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { toast } from "./use-toast";

export const useAssetDelete = () => {
  return useMutation<void, Error, UserAsset["id"]>({
    mutationFn: (id) => apiRequest<void>("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset deleted",
        description: "Your asset has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error("Error deleting asset", error);
      toast({
        title: "Error deleting asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
