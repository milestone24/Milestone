import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

type SecuritiesUpdateResponse = {
  success: boolean;
}

export const useSecuritiesUpdate = (assetId: string) => {

  return useMutation({
    mutationFn: async () => {
      return apiRequest<SecuritiesUpdateResponse>("PUT", `/api/assets/broker/${assetId}/history/update`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/broker/${assetId}/history`] });
    },
  });
};