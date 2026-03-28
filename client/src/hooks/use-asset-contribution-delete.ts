import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { AssetTransaction } from "@shared/schema";

type AssetContributionDelete = {
  contributionId: AssetTransaction["id"];
};

export const useAssetContributionDelete = (assetId: string) => {
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
      toast({
        title: "Contribution deleted",
        description: "Your contribution has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
