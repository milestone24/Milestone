import { apiRequest } from "../../api/transport";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { TransactionTimePoint, transactionTimePointSchema } from "../../schema";
import { getDateUrlParams } from "../../utils/date";
import { portfolioGraphTransactions } from "../../api/queryKeys";

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
