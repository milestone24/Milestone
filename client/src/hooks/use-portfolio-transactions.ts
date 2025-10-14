import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { TransactionTimePoint } from "@shared/schema";
import { getDateUrlParams } from "@/lib/date";
import { portfolioGraphTransactions } from "@shared/api/queryKeys";

export const usePortfolioTransactionHistory = (
  startDate?: Date,
  endDate?: Date
) =>
  useQuery({
    queryKey: [...portfolioGraphTransactions, startDate, endDate],
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
