import { apiRequest } from "@/lib/queryClient";
import { assetProcesses as assetProcessesKey } from "@shared/api/queryKeys";
import { ProcessSelect, processSelectSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export const useAssetProcesses = (assetId: string | undefined) => {
  const { data: activeProcesses = [], isLoading } = useQuery<ProcessSelect[]>({
    queryKey: [...assetProcessesKey, assetId],
    queryFn: async () => {
      const data = await apiRequest<ProcessSelect[]>(
        "GET",
        `/api/assets/${assetId}/processes`
      );
      const result = processSelectSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(
          `Invalid asset processes response: ${result.error.message}`
        );
      }
      return result.data;
    },
    enabled: !!assetId,
    refetchInterval: (query) =>
      query.state.data && query.state.data.length > 0 ? 5000 : false,
  });

  return {
    activeProcesses,
    hasActiveProcesses: activeProcesses.length > 0,
    isLoading,
  };
};
