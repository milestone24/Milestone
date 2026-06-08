import { apiRequest } from "../../api/transport";
import { assetValues } from "../../api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type SecuritiesUpdateResponse = {
  success: boolean;
}

export const useSecuritiesUpdate = (assetId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return apiRequest<SecuritiesUpdateResponse>(
        "PUT",
        `/api/assets/${assetId}/history/update`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...assetValues, assetId],
      });
    },
    onError: (error) => {
      console.error("Error updating asset histories:", error);
    },
  });
};