import {
  assetFlatTransactions,
  assetGraphTransactions,
  assetGraphValues,
  assetSecuritiesTransactions,
} from "@shared/api/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  TransactionBundleInsert,
  TransactionBundleResponse,
  transactionBundleResponseSchema,
} from "@shared/schema";

export const useTransactionBundle = (assetId: string) => {
  const queryClient = useQueryClient();

  const invalidateRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: [...assetFlatTransactions, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetGraphValues, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetGraphTransactions, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetSecuritiesTransactions, assetId] });
  };

  const createBundle = useMutation<TransactionBundleResponse, Error, TransactionBundleInsert>({
    mutationFn: async (data: TransactionBundleInsert) => {
      const raw = await apiRequest<unknown>(
        "POST",
        `/api/assets/${assetId}/transactions/bundle`,
        data
      );
      const parsed = transactionBundleResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error("Invalid bundle response from server");
      }
      return parsed.data;
    },
    onSuccess: () => {
      invalidateRelatedQueries();
      toast({
        title: "Transaction recorded",
        description: "Trade and cash movement have been recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error recording transaction",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

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

  return { createBundle, deleteBundle };
};
