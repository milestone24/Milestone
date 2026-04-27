import { assetFlatTransactions } from "@shared/api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  AssetTransaction,
  AssetContributionInsert,
} from "@shared/schema";

type AssetContributionUpdate = AssetContributionInsert & {
  contributionId: AssetTransaction["id"];
};

export const useAssetContributionUpdate = (assetId: string) => {
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
      toast({
        title: "Contribution updated",
        description: "Your contribution has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
