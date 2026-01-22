import { apiRequest } from "@/lib/queryClient";
import { ResolvedUserAsset, resolvedUserAssetSchema } from "@shared/schema/portfolio-assets";
import { useQuery } from "@tanstack/react-query";

export const useAsset = (assetId: string | undefined) => {
  const {
    data: asset,
    isLoading: isAssetLoading,
    isError: isAssetError,
    error: assetError,
  } = useQuery<ResolvedUserAsset>({
    queryKey: ["assets", assetId],
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
