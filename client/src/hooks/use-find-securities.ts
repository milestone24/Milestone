import { apiRequest } from "@/lib/queryClient";
import { SecuritySearchResult, securitySearchResultSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export const useFindSecurities = (query?: string | undefined) => {
  return useQuery<SecuritySearchResult[]>({
    queryKey: ["securities", "search", query],
    queryFn: async () => {
      if (!query || query.length < 3) return [];
      const data = await apiRequest<SecuritySearchResult[]>("GET", `/api/securities/search?q=${query}`);
      const result = securitySearchResultSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid security search response: ${result.error.message}`);
      }
      return result.data;
    },
    enabled: !!query,
  })
}
