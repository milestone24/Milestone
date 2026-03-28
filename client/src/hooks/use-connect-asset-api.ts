import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { UserAsset } from "@shared/schema";
import { portfolioAssets } from "@shared/api/queryKeys";

export const useConnectAssetApi = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: UserAsset["id"]; apiKey: string }>({
    mutationFn: ({ id, apiKey }) =>
      apiRequest("PATCH", `/api/assets/${id}/connect-api`, { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      toast({
        title: "API connected",
        description: "Your asset has been connected to the API successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error connecting API",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
