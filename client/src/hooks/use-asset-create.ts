import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { portfolioGraphValues } from "@shared/api/queryKeys";
import { UserAsset, UserAssetOrphanInsert } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { toast } from "./use-toast";
import {
  portfolioAssets,
  portfolioGraphTransactions,
} from "@shared/api/queryKeys";

export const useAssetCreate = () => {
  return useMutation<UserAsset, Error, UserAssetOrphanInsert>({
    mutationFn: (newAsset) =>
      apiRequest<UserAsset>("POST", "/api/assets/", newAsset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset added",
        description: "Your asset has been added successfully.",
      });
    },
    onError: (error) => {
      console.error("Error adding asset", error);
      toast({
        title: "Error adding asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
