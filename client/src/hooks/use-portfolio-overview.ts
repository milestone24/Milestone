import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import { portfolioOverview } from "@shared/api/queryKeys";
import { ValueChange } from "@shared/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const usePortfolioOverview = (startDate?: Date, endDate?: Date) => {
  return useQuery<ValueChange>({
    queryKey: [...portfolioOverview, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiRequest<ValueChange>(
        "GET",
        `/api/assets/portfolio-overview?${getDateUrlParams(startDate, endDate)}`
      ),
  });
};
