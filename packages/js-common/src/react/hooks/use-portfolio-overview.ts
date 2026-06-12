import { getDateUrlParams } from "../../utils/date";
import { apiRequest } from "../../api/transport";
import { portfolioOverview } from "../../api/queryKeys";
import { assetsChangeSchema, ValueChange } from "../../schema";
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
