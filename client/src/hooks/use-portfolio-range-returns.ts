import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import { portfolioRangeReturns } from "@shared/api/queryKeys";
import {
  portfolioRangeReturnsSchema,
  type PortfolioRangeReturns,
} from "@shared/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const usePortfolioRangeReturns = (startDate?: Date, endDate?: Date) => {
  return useQuery<PortfolioRangeReturns>({
    queryKey: [...portfolioRangeReturns, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await apiRequest<PortfolioRangeReturns>(
        "GET",
        `/api/assets/portfolio-value/returns?${getDateUrlParams(startDate, endDate)}`
      );
      const result = portfolioRangeReturnsSchema.safeParse(data);
      if (!result.success) {
        throw new Error(
          `Invalid portfolio range returns response: ${result.error.message}`
        );
      }
      return result.data;
    },
  });
};
