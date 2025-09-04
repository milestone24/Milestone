import { apiRequest } from "@/lib/queryClient";
import { ResolvedUserAsset } from "@shared/schema/portfolio-assets";
import { useQuery } from "@tanstack/react-query";

export const useAsset = (assetId: string | undefined) => {
  const {
    data: asset,
    isLoading: isAssetLoading,
    isError: isAssetError,
    error: assetError,
  } = useQuery<ResolvedUserAsset>({
    queryKey: ["assets", assetId],
    queryFn: () =>
      apiRequest<ResolvedUserAsset>("GET", `/api/assets/${assetId}`),
    enabled: !!assetId,
  });

  return {
    asset,
    isAssetLoading,
    isAssetError,
    assetError,
  };
};
