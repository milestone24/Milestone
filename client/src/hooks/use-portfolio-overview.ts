import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import { portfolioOverview } from "@shared/api/queryKeys";
import { assetsChangeSchema, ValueChange } from "@shared/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const usePortfolioOverview = (startDate?: Date, endDate?: Date) => {
  return useQuery<ValueChange>({
    queryKey: [...portfolioOverview, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await apiRequest<ValueChange>(
        "GET",
        `/api/assets/portfolio-overview?${getDateUrlParams(startDate, endDate)}`
      );
      const result = assetsChangeSchema.safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid portfolio overview response: ${result.error.message}`);
      }
      return result.data;
    },
  });
};
