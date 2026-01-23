import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAsset, UserAssetOrphanInsert, UserAssetUpdate } from "@shared/schema";
import { toast } from "./use-toast";
import { asset as assetQueryKey, portfolioAssets, portfolioGraphTransactions, portfolioGraphValues, assetSecuritiesTransactions, assetSecurities } from "@shared/api/queryKeys";

// type UserAssetUpdate = UserAssetOrphanInsert & {
//   id: UserAsset["id"];
// };

export const useAssetUpdate = (assetId: string) => {

  return useMutation<UserAsset, Error, UserAssetUpdate>({
    mutationFn: (data) => {
      console.log("PATCH data", JSON.stringify(data, null, 2));
      return apiRequest<UserAsset>("PATCH", `/api/assets/${assetId}`, {
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: [...assetQueryKey, assetId] });
      queryClient.invalidateQueries({ queryKey: [...assetSecurities, assetId] });
      queryClient.invalidateQueries({ queryKey: [...assetSecuritiesTransactions, assetId] });
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