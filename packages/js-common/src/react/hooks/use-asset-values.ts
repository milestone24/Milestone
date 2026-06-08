import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import {
  AssetValue,
  UserAssetValueOrphanInsert,
  assetValueHistorySchema,
} from "../../schema";
import {
  assetGraphValues,
  assetGraphTransactions,
  portfolioAssets,
  portfolioGraphValues,
  portfolioGraphTransactions,
  assetValues,
} from "../../api/queryKeys";

type AssetValueUpdate = UserAssetValueOrphanInsert & {
  historyId: AssetValue["id"];
};

export function useAssetValues(assetId: string | undefined) {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const query = useQuery<AssetValue[]>({
    queryKey: [...assetValues, assetId ?? ""],
    queryFn: async () => {
      const data = await apiRequest<AssetValue[]>(
        "GET",
        `/api/assets/${assetId}/history?sort=valueDate,desc`
      );
      const result = assetValueHistorySchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid asset values response: ${result.error.message}`);
      }
      return result.data;
    },
    enabled: !!assetId,
  });

  const invalidateRelatedQueries = () => {
    queryClient.invalidateQueries({
      queryKey: [...assetValues, assetId ?? ""],
    });
    queryClient.invalidateQueries({
      queryKey: [...assetGraphValues],
    });
    queryClient.invalidateQueries({
      queryKey: [...assetGraphTransactions],
    });
    queryClient.invalidateQueries({
      queryKey: portfolioAssets,
    });
    queryClient.invalidateQueries({
      queryKey: portfolioGraphValues,
    });
    queryClient.invalidateQueries({
      queryKey: portfolioGraphTransactions,
    });
  };

  const addAssetValue = useMutation<
    AssetValue,
    Error,
    UserAssetValueOrphanInsert
  >({
    mutationFn: (data: UserAssetValueOrphanInsert) =>
      apiRequest<AssetValue>("POST", `/api/assets/${assetId}/history`, {
        ...data,
        recordedAt: data.recordedAt ?? new Date(),
      }),
    onSuccess: () => {
      invalidateRelatedQueries();
      notify({
        title: "Asset value added",
        description: "Asset value has been added successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error adding asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateAssetValue = useMutation<AssetValue, Error, AssetValueUpdate>({
    mutationFn: ({ historyId, ...data }: AssetValueUpdate) =>
      apiRequest<AssetValue>(
        "PUT",
        `/api/assets/${assetId}/history/${historyId}`,
        data
      ),
    onSuccess: () => {
      invalidateRelatedQueries();
      notify({
        title: "Asset value updated",
        description: "Asset value has been updated successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error updating asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteAssetValue = useMutation<void, Error, { historyId: string }>({
    mutationFn: ({ historyId }: { historyId: string }) =>
      apiRequest<void>("DELETE", `/api/assets/${assetId}/history/${historyId}`),
    onSuccess: () => {
      invalidateRelatedQueries();
      notify({
        title: "Asset value deleted",
        description: "Asset value has been deleted successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error deleting asset value",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return {
    assetValues: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    addAssetValue,
    updateAssetValue,
    deleteAssetValue,
  };
}
