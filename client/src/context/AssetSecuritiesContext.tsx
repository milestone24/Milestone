import {
  assetGraphTransactions,
  assetGraphValues,
  assetSecurities,
  assetSecuritiesTransactions,
} from "@shared/api/queryKeys";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  resolvedAssetSecuritiesSchema,
  ResolvedAssetSecurity,
  UserAssetSecurityLinkInsert,
  UserAssetSecurityOrphanNewCreateInsert,
  UserAssetSecuritySelect,
} from "@shared/schema/portfolio-assets";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useState } from "react";

export type AssetSecuritiesContextType = {
  assetId: string | undefined;
  assetStartDate: Date | undefined;
};

const AssetSecuritiesContext = createContext<AssetSecuritiesContextType>({
  assetId: undefined,
  assetStartDate: undefined,
});

export const AssetSecuritiesProvider = ({
  children,
  assetId,
  assetStartDate,
}: {
  children: ReactNode;
  assetId: string | undefined;
  assetStartDate: Date | undefined;
}) => {
  return (
    <AssetSecuritiesContext.Provider value={{ assetId, assetStartDate }}>
      {children}
    </AssetSecuritiesContext.Provider>
  );
};

export const useAssetSecurities = () => {
  const { assetId, assetStartDate } = useContext(AssetSecuritiesContext);

  const {
    data: securities = [],
    isLoading: isSecuritiesLoading,
    isError: isSecuritiesError,
    error: securitiesError,
  } = useQuery<ResolvedAssetSecurity[]>({
    queryKey: [...assetSecurities, assetId],
    queryFn: async () => {
      const response = await apiRequest<ResolvedAssetSecurity[]>(
        "GET",
        `/api/assets/${assetId}/securities`
      );

      const validation = resolvedAssetSecuritiesSchema.safeParse(response);
      if (!validation.success) {
        throw new Error(validation.error.message);
      }
      return validation.data;
    },
  });

  const addSecurity = useMutation<
    UserAssetSecuritySelect,
    Error,
    UserAssetSecurityOrphanNewCreateInsert
  >({
    mutationFn: (security) => {
      return apiRequest("POST", `/api/assets/${assetId}/securities`, security);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...assetSecurities, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphValues, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphTransactions, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetSecuritiesTransactions, assetId],
      });
    },
  });

  const deleteSecurity = useMutation<void, Error, string>({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/assets/${assetId}/securities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...assetSecurities, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphValues, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphTransactions, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetSecuritiesTransactions, assetId],
      });
    },
  });

  const updateSecurity = useMutation<
    UserAssetSecuritySelect,
    Error,
    { id: string; security: UserAssetSecurityLinkInsert }
  >({
    mutationFn: ({ id, security }) => {
      return apiRequest(
        "PUT",
        `/api/assets/${assetId}/securities/${id}`,
        security
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...assetSecurities, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphValues, assetId],
      });
      queryClient.invalidateQueries({
        queryKey: [...assetGraphTransactions, assetId],
      });
    },
  });

  if (assetId === undefined) {
    throw new Error(
      "useAssetSecurities must be used within a AssetSecuritiesProvider"
    );
  }

  return {
    assetId,
    securities,
    isSecuritiesLoading,
    addSecurity,
    deleteSecurity,
    updateSecurity,
    assetStartDate,
  };
};
