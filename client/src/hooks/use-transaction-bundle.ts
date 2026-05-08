import {
  assetFlatTransactions,
  assetGraphTransactions,
  assetGraphValues,
  assetSecuritiesTransactions,
} from "@shared/api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export const useTransactionBundle = (assetId: string) => {
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
      toast({
        title: "Bundle deleted",
        description: "Trade and linked cash movement have been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting bundle",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return { deleteBundle };
};
