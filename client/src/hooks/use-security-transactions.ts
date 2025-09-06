import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  SecurityTransactionInsert,
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema/securities";
import { useMutation, useQuery } from "@tanstack/react-query";

export type SecurityTransactionCreateRequest<> = {
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
    queryKey: ["assets", assetId, "securities", "transactions"],
    queryFn: () =>
      apiRequest<UserAssetSecurityTransactionResolved[]>(
        "GET",
        // TODO: Change this to transactions when api is updated
        `/api/assets/${assetId}/securities/transactions`
      ),
  });

  const addSecurityTransaction = useMutation<
    SecurityTransactionSelect,
    Error,
    SecurityTransactionCreateRequest
  >({
    mutationFn: ({ securityId, data }) => {
      console.log("addSecurityTransaction data", data);
      return apiRequest(
        "POST",
        `/api/assets/${assetId}/securities/${securityId}/transactions`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assets", assetId, "securities", "transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["assets", assetId, "history", "graph"],
      });
    },
  });

  const updateSecurityTransaction = useMutation<
    SecurityTransactionSelect,
    Error,
    SecurityTransactionUpdateRequest
  >({
    mutationFn: ({ securityId, transactionId, data }) => {
      return apiRequest(
        "PUT",
        `/api/assets/${assetId}/securities/${securityId}/transactions/${transactionId}`,
        data
      );
    },
  });

  const deleteSecurityTransaction = useMutation<void, Error, string>({
    mutationFn: (id: string) => {
      return apiRequest(
        "DELETE",
        `/api/assets/${assetId}/securities/${id}/transactions`,
        { id }
      );
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
