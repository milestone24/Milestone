import {
  assetGraphTransactions,
  assetGraphValues,
  assetSecurities,
} from "@/api/queryKeys";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SecurityTransactionUpsert } from "@shared/schema";
import {
  ResolvedSecurity,
  UserAssetSecurityInsert,
  UserAssetSecuritySelect,
} from "@shared/schema/portfolio-assets";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useState } from "react";

export type AssetSecuritiesContextType = {
  assetId: string | undefined;
};

const AssetSecuritiesContext = createContext<AssetSecuritiesContextType>({
  assetId: undefined,
});

export const AssetSecuritiesProvider = ({
  children,
  assetId,
}: {
  children: ReactNode;
  assetId: string | undefined;
}) => {
  return (
    <AssetSecuritiesContext.Provider value={{ assetId }}>
      {children}
    </AssetSecuritiesContext.Provider>
  );
};

export const useAssetSecurities = () => {
  const { assetId } = useContext(AssetSecuritiesContext);

  const {
    data: securities = [],
    isLoading: isSecuritiesLoading,
    isError: isSecuritiesError,
    error: securitiesError,
  } = useQuery<ResolvedSecurity[]>({
    queryKey: [...assetSecurities, assetId],
    queryFn: () =>
      apiRequest<ResolvedSecurity[]>(
        "GET",
        `/api/assets/${assetId}/securities`
      ),
  });

  const addSecurity = useMutation<
    UserAssetSecuritySelect,
    Error,
    UserAssetSecurityInsert
  >({
    mutationFn: (security) =>
      apiRequest("POST", `/api/assets/${assetId}/securities`, security),
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
  };
};
