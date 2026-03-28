/**
 * Do not reate new code that uses this Context.
 * This Context is deprecated and will be removed in the future.
 */

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  UserAsset,
  AssetValue,
  UserAssetValueInsert,
} from "@shared/schema";
import {
  portfolioAssets,
  portfolioGraphTransactions,
  portfolioGraphValues,
} from "@shared/api/queryKeys";

export type PortfolioContextType = {
  assets: UserAsset[];
  activeSection: string;
};

type AssetValueUpdate = UserAssetValueInsert & {
  historyId: AssetValue["id"];
};

type AssetValueDelete = {
  assetId: UserAsset["id"];
  historyId: AssetValue["id"];
};

// Create the context
const PortfolioContext = createContext<PortfolioContextType | undefined>(
  undefined,
);
// Provider component
export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const value: PortfolioContextType = {
    assets: [],
    activeSection: "portfolio",
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

/**
 * @deprecated use individual specific hooks instead
 */
export const usePortfolio = () => {
  const context = useContext(PortfolioContext);

  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }

  const queryClient = useQueryClient();

  const invalidateAccounts = useCallback(() => {
    queryClient.invalidateQueries({
      //We need fetch all queries for the time being
      //The portolfio chart is out of view and so would not be refetched otherwise
      refetchType: "all",
    });
  }, [queryClient]);

  // Add new mutations for account history
  const addAssetValue = useMutation<
    UserAssetValueInsert,
    Error,
    UserAssetValueInsert
  >({
    mutationFn: (data: UserAssetValueInsert) => {
      const { assetId, ...rest } = data;
      return apiRequest<AssetValue>("POST", `/api/assets/${assetId}/history`, {
        ...rest,
        recordedAt: data.recordedAt ?? new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
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
    mutationFn: (data) => {
      const { assetId, historyId, ...rest } = data;
      return apiRequest<AssetValue>(
        "PUT",
        `/api/assets/${assetId}/history/${historyId}`,
        {
          ...rest,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      queryClient.invalidateQueries({ queryKey: portfolioGraphValues });
      queryClient.invalidateQueries({ queryKey: portfolioGraphTransactions });
      toast({
        title: "Asset value updated",
        description: "Asset value has been updated successfully.",
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

  const deleteAssetValue = useMutation<void, Error, AssetValueDelete>({
    mutationFn: ({ assetId, historyId }) =>
      apiRequest<void>("DELETE", `/api/assets/${assetId}/history/${historyId}`),
    onSuccess: () => {
      invalidateAccounts();
      toast({
        title: "Asset value deleted",
        description: "Asset value has been deleted successfully.",
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

  return {
    ...context,
    addAssetValue,
    updateAssetValue,
    deleteAssetValue,
  };
};
