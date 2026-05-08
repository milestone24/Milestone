import {
  assetFlatTransactions,
  assetGraphTransactions,
  assetGraphValues,
  assetSecurities,
  assetSecuritiesTransactions,
} from "@shared/api/queryKeys";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  SecurityTransactionInsert,
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  UserAssetSecurityOrphanCreate,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { userAssetSecurityTransactionResolvedSchema } from "@shared/schema/transaction";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "./use-toast";

// export type SecurityTransactionCreateRequest = {
//   securityId: string;
//   data: SecurityTransactionOrphanInsert;
// };

export type SecurityTransactionUpdateRequest = {
  securityId: string;
  transactionId: string;
  data: SecurityTransactionOrphanInsert;
};

type DeleteVariables = { assetSecurityId: string; transactionId: string };
type RollbackContext = { previous?: UserAssetSecurityTransactionResolved[] };

export const useSecurityTransactions = (assetId: string) => {
  const transactionsQueryKey = [...assetSecuritiesTransactions, assetId];

  const { data: transactions, isLoading: isTransactionsLoading } = useQuery<
    UserAssetSecurityTransactionResolved[]
  >({
    queryKey: transactionsQueryKey,
    enabled: !!assetId,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/assets/${assetId}/securities/transactions`
      );
      const result = userAssetSecurityTransactionResolvedSchema
        .array()
        .safeParse(response);
      if (!result.success) {
        console.error("security transactions parse error", result.error);
        throw new Error("Invalid security transactions result");
      }
      return result.data;
    },
  });

  const invalidateRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    queryClient.invalidateQueries({ queryKey: [...assetGraphValues, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetGraphTransactions, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetFlatTransactions, assetId] });
    queryClient.invalidateQueries({ queryKey: [...assetSecurities, assetId] });
  };

  async function cancelAndSnapshot(): Promise<RollbackContext> {
    await queryClient.cancelQueries({ queryKey: transactionsQueryKey });
    return {
      previous: queryClient.getQueryData<UserAssetSecurityTransactionResolved[]>(transactionsQueryKey),
    };
  }

  function rollback(context: RollbackContext | undefined) {
    if (context?.previous) {
      queryClient.setQueryData(transactionsQueryKey, context.previous);
    }
  }

  const addSecurityTransaction = useMutation<
    SecurityTransactionSelect,
    Error,
    SecurityTransactionInsert
  >({
    mutationFn: (data: SecurityTransactionInsert) => {

      if (data.mode === "existing") {
        return apiRequest(
          "POST",
          `/api/assets/${assetId}/securities/${data.assetSecurityId}/transactions`,
          data
        );
      } else if (data.mode === "new") {

        const newSecurityData: UserAssetSecurityOrphanCreate = {
          type: "new",
          security: data.security,
          startDate: data.valueDate,
          initialHolding: {
            shareHolding: data.value,
            currencyValue: data.currencyValue,
          },
          fundedFromCash: data.fundedFromCash,
        }

        return apiRequest(
          "POST",
          `/api/assets/${assetId}/securities`,
          newSecurityData
        );
      } else {
        throw new Error("Invalid transaction mode");
      }
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
    SecurityTransactionUpdateRequest,
    RollbackContext
  >({
    mutationFn: async ({ securityId, transactionId, data }) => {
      return apiRequest(
        "PUT",
        `/api/assets/${assetId}/securities/${securityId}/transactions/${transactionId}`,
        data
      );
    },
    onMutate: async ({ transactionId, data }) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.previous) {
        queryClient.setQueryData<UserAssetSecurityTransactionResolved[]>(
          transactionsQueryKey,
          ctx.previous.map((t) =>
            t.id === transactionId ? { ...t, ...data } : t
          )
        );
      }
      return ctx;
    },
    onError: (_error, _vars, context) => {
      rollback(context);
      toast({
        title: "Error updating transaction",
        description:
          _error instanceof Error ? _error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      invalidateRelatedQueries();
      toast({
        title: "Transaction updated",
        description: "Security transaction has been updated successfully.",
      });
    },
  });

  const deleteSecurityTransaction = useMutation<void, Error, DeleteVariables>({
    mutationFn: ({ assetSecurityId, transactionId }: DeleteVariables) => {
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
