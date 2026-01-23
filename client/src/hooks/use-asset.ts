import { apiRequest } from "@/lib/queryClient";
import { ResolvedUserAsset, resolvedUserAssetSchema } from "@shared/schema/portfolio-assets";
import { useQuery } from "@tanstack/react-query";
import { asset as assetQueryKey } from "@shared/api/queryKeys";

export const useAsset = (assetId: string | undefined) => {
  const {
    data: asset,
    isLoading: isAssetLoading,
    isError: isAssetError,
    error: assetError,
  } = useQuery<ResolvedUserAsset>({
    queryKey: [...assetQueryKey, assetId],
    queryFn: async () => {
      const response = await apiRequest<ResolvedUserAsset>("GET", `/api/assets/${assetId}`);
      const result = resolvedUserAssetSchema.safeParse(response);
      if (!result.success) {
        throw new Error("Invalid asset result");
      }
      return result.data;
    },
    enabled: !!assetId,
  });

  return {
    asset,
    isAssetLoading,
    isAssetError,
    assetError,
  };
};
