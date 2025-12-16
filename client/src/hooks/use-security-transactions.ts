import {
  assetGraphTransactions,
  assetGraphValues,
  assetSecuritiesTransactions,
} from "@shared/api/queryKeys";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "./use-toast";

export type SecurityTransactionCreateRequest = {
  securityId: string;
  data: SecurityTransactionOrphanInsert;
};

export type SecurityTransactionUpdateRequest = {
  securityId: string;
  transactionId: string;
  data: SecurityTransactionOrphanInsert;
};

export const useSecurityTransactions = (assetId: string) => {
  const { data: transactions, isLoading: isTransactionsLoading } = useQuery<
    UserAssetSecurityTransactionResolved[]
  >({
    queryKey: [...assetSecuritiesTransactions, assetId],
    queryFn: () =>
      apiRequest<UserAssetSecurityTransactionResolved[]>(
        "GET",
        // TODO: Change this to transactions when api is updated
        `/api/assets/${assetId}/securities/transactions`
      ),
  });

  const invalidateRelatedQueries = () => {
    queryClient.invalidateQueries({
      queryKey: [...assetSecuritiesTransactions, assetId],
    });
    queryClient.invalidateQueries({
      queryKey: [...assetGraphValues, assetId],
    });
    queryClient.invalidateQueries({
      queryKey: [...assetGraphTransactions, assetId],
    });
  };

  const addSecurityTransaction = useMutation<
    SecurityTransactionSelect,
    Error,
    SecurityTransactionCreateRequest
  >({
    mutationFn: ({ securityId, data }) => {
      return apiRequest(
        "POST",
        `/api/assets/${assetId}/securities/${securityId}/transactions`,
        data
      );
    },
    onSuccess: () => {
      invalidateRelatedQueries();
      toast({
        title: "Transaction added",
        description: "Security transaction has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding transaction",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateSecurityTransaction = useMutation<
    SecurityTransactionSelect,
    Error,
    SecurityTransactionUpdateRequest
  >({
    mutationFn: async ({ securityId, transactionId, data }) => {
      return apiRequest(
        "PUT",
        `/api/assets/${assetId}/securities/${securityId}/transactions/${transactionId}`,
        data
      );
    },
    onSuccess: () => {
      invalidateRelatedQueries();
      toast({
        title: "Transaction updated",
        description: "Security transaction has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating transaction",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteSecurityTransaction = useMutation<
    void,
    Error,
    {
      assetSecurityId: string;
      transactionId: string;
    }
  >({
    mutationFn: ({
      assetSecurityId,
      transactionId,
    }: {
      assetSecurityId: string;
      transactionId: string;
    }) => {
      return apiRequest(
        "DELETE",
        `/api/assets/${assetId}/securities/${assetSecurityId}/transactions/${transactionId}`
      );
    },
    onSuccess: () => {
      invalidateRelatedQueries();
      toast({
        title: "Transaction deleted",
        description: "Security transaction has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting transaction",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return {
    transactions,
    isTransactionsLoading,
    addSecurityTransaction,
    updateSecurityTransaction,
    deleteSecurityTransaction,
  };
};
