import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import { UserAsset } from "../../schema";
import { portfolioAssets } from "../../api/queryKeys";

export const useConnectAssetApi = () => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: UserAsset["id"]; apiKey: string }>({
    mutationFn: ({ id, apiKey }) =>
      apiRequest("PATCH", `/api/assets/${id}/connect-api`, { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      notify({
        title: "API connected",
        description: "Your asset has been connected to the API successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error connecting API",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
