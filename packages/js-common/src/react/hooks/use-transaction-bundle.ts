import {
  assetFlatTransactions,
  assetGraphTransactions,
  assetGraphValues,
  assetSecuritiesTransactions,
} from "../../api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';

export const useTransactionBundle = (assetId: string) => {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  const invalidateRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: [...assetFlatTransactions, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetGraphValues, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetGraphTransactions, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetSecuritiesTransactions, assetId] });
  };

  const deleteBundle = useMutation<void, Error, string>({
    mutationFn: (groupId: string) =>
      apiRequest("DELETE", `/api/assets/${assetId}/transactions/bundle/${groupId}`),
    onSuccess: () => {
      invalidateRelatedQueries();
      notify({
        title: "Bundle deleted",
        description: "Trade and linked cash movement have been removed.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error deleting bundle",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return { deleteBundle };
};
