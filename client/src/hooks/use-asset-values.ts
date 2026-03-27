import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  AssetValue,
  UserAssetValueOrphanInsert,
  assetValueHistorySchema,
} from "@shared/schema";
import {
  assetGraphValues,
  assetGraphTransactions,
  portfolioAssets,
  portfolioGraphValues,
  portfolioGraphTransactions,
  assetValues,
} from "@shared/api/queryKeys";

type AssetValueUpdate = UserAssetValueOrphanInsert & {
  historyId: AssetValue["id"];
};

export function useAssetValues(assetId: string | undefined) {
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
      toast({
        title: "Asset value added",
        description: "Asset value has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
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
      toast({
        title: "Asset value updated",
        description: "Asset value has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
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
      toast({
        title: "Asset value deleted",
        description: "Asset value has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
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
