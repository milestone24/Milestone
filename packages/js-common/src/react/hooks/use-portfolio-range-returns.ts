import { getDateUrlParams } from "../../utils/date";
import { apiRequest } from "../../api/transport";
import { portfolioRangeReturns } from "../../api/queryKeys";
import {
  portfolioRangeReturnsSchema,
  type PortfolioRangeReturns,
} from "../../schema";
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
