import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import { portfolioOverview, portfolioValue } from "@shared/api/queryKeys";
import { ValueChange, PortfolioValue } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export const usePortfolioValue = () => {
  return useQuery<PortfolioValue>({
    queryKey: [...portfolioValue],
    queryFn: () =>
      apiRequest<PortfolioValue>(
        "GET",
        `/api/assets/portfolio-value`
      ),
  });
};
