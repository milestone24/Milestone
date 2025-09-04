import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

type SecuritiesUpdateResponse = {
  success: boolean;
}

export const useSecuritiesUpdate = (assetId: string) => {

  return useMutation({
    mutationFn: async () => {
      return apiRequest<SecuritiesUpdateResponse>(
        "PUT",
        `/api/assets/${assetId}/history/update`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/assets/${assetId}/history`],
      });
    },
    onError: (error) => {
      console.error("Error updating asset histories:", error);
    },
  });
};