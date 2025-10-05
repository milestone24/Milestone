import {
  assetGraphTransactions,
  assetGraphValues,
  assetSecuritiesTransactions,
} from "@/api/queryKeys";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  SecurityTransactionInsert,
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema/securities";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "./use-toast";

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
    queryKey: [...assetSecuritiesTransactions, assetId],
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
        queryKey: [...assetSecuritiesTransactions, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphValues, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphTransactions, assetId],
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
      queryClient.invalidateQueries({
        queryKey: [...assetSecuritiesTransactions, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphValues, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphTransactions, assetId],
      });
      toast({
        title: "Transaction deleted successfully",
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
