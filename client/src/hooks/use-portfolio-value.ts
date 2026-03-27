import { apiRequest } from "@/lib/queryClient";
import { portfolioValue } from "@shared/api/queryKeys";
import { PortfolioValue, portfolioValueSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export const usePortfolioValue = () => {
  return useQuery<PortfolioValue>({
    queryKey: [...portfolioValue],
    queryFn: async () => {
      const data = await apiRequest<PortfolioValue>(
        "GET",
        `/api/assets/portfolio-value`
      );
      const result = portfolioValueSchema.safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid portfolio value response: ${result.error.message}`);
      }
      return result.data;
    },
  });
};
