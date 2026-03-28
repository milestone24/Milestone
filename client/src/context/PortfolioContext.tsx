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
  AssetTransaction,
  AssetContributionInsert,
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

type AssetContributionUpdate = AssetContributionInsert & {
  contributionId: AssetTransaction["id"];
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

  const connectAssetApi = useMutation<
    void,
    Error,
    { id: UserAsset["id"]; apiKey: string }
  >({
    mutationFn: async ({ id, apiKey }) =>
      apiRequest("PATCH", `/api/assets/${id}/connect-api`, {
        apiKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioAssets });
      toast({
        title: "API connected",
        description: "Your asset has been connected to the API successfully.",
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

  // Asset contribution mutations
  const addAssetContribution = useMutation<
    AssetTransaction,
    Error,
    AssetContributionInsert
  >({
    mutationFn: (data: AssetContributionInsert) => {
      const { assetId, ...rest } = data;
      return apiRequest<AssetTransaction>(
        "POST",
        `/api/assets/${assetId}/contributions`,
        {
          ...rest,
          recordedAt: new Date(),
        },
      );
    },
    onSuccess: (data) => {
      invalidateAccounts();
      queryClient.invalidateQueries({
        queryKey: ["asset", data.assetId, "contributions"],
      });
      toast({
        title: "Contribution recorded",
        description: "Your contribution has been recorded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error recording contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateAssetContribution = useMutation<
    AssetTransaction,
    Error,
    AssetContributionUpdate
  >({
    mutationFn: (data) => {
      const { assetId, contributionId, ...rest } = data;
      return apiRequest<AssetTransaction>(
        "PUT",
        `/api/assets/${assetId}/contributions/${contributionId}`,
        {
          ...rest,
        },
      );
    },
    onSuccess: () => {
      invalidateAccounts();
      toast({
        title: "Contribution updated",
        description: "Your contribution has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteAssetContribution = useMutation<
    void,
    Error,
    {
      assetId: UserAsset["id"];
      contributionId: AssetTransaction["id"];
    }
  >({
    mutationFn: ({ assetId, contributionId }) =>
      apiRequest(
        "DELETE",
        `/api/assets/${assetId}/contributions/${contributionId}`,
      ),
    onSuccess: () => {
      invalidateAccounts();
      toast({
        title: "Contribution deleted",
        description: "Your contribution has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting contribution",
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
    addAssetContribution,
    updateAssetContribution,
    deleteAssetContribution,
    connectAssetApi,
  };
};
