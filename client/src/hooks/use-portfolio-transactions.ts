import { apiRequest } from "@/lib/queryClient";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { TransactionTimePoint, transactionTimePointSchema } from "@shared/schema";
import { getDateUrlParams } from "@/lib/date";
import { portfolioGraphTransactions } from "@shared/api/queryKeys";

export const usePortfolioTransactionHistory = (
  startDate?: Date,
  endDate?: Date
) =>
  useQuery({
    queryKey: [...portfolioGraphTransactions, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await apiRequest<TransactionTimePoint[]>(
        "GET",
        `/api/assets/portfolio-value/transactions?${getDateUrlParams(
          startDate,
          endDate
        )}`
      );
      const result = transactionTimePointSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid portfolio transaction history response: ${result.error.message}`);
      }
      return result.data;
    },
  });
