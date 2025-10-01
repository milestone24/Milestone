import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { TransactionTimePoint } from "@shared/schema";
import { getDateUrlParams } from "@/lib/date";

export const usePortfolio = (startDate?: Date, endDate?: Date) => {
  const portfolioTransactions = useQuery({
    queryKey: ["portfolio-transactions", startDate, endDate],
    queryFn: () => {
      return apiRequest<TransactionTimePoint[]>(
        "GET",
        `/api/assets/portfolio-value/transactions?${getDateUrlParams(
          startDate,
          endDate
        )}`
      );
    },
  });

  return {
    portfolioTransactions,
  };
};
