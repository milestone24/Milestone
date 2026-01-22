import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAsset, UserAssetOrphanInsert } from "@shared/schema";
import { toast } from "./use-toast";
import { portfolioAssets, portfolioGraphTransactions, portfolioGraphValues } from "@shared/api/queryKeys";

// type UserAssetUpdate = UserAssetOrphanInsert & {
//   id: UserAsset["id"];
// };

export const useAssetUpdate = (assetId: string) => {

  return useMutation<UserAsset, Error, UserAssetOrphanInsert>({
    mutationFn: (data) => {
      return apiRequest<UserAsset>("PUT", `/api/assets/${assetId}`, {
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset updated",
        description: "Your asset has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating asset",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
}