import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import { portfolioOverview } from "@shared/api/queryKeys";
import { AssetsChange } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export const usePortfolioOverview = (startDate?: Date, endDate?: Date) => {
  return useQuery<AssetsChange>({
    queryKey: [...portfolioOverview, startDate, endDate],
    queryFn: () =>
      apiRequest<AssetsChange>(
        "GET",
        `/api/assets/portfolio-overview?${getDateUrlParams(startDate, endDate)}`
      ),
  });
};
