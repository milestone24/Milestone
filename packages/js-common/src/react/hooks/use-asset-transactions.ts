import { assetGraphTransactions } from "../../api/queryKeys";
import { getDateUrlParams } from "../../utils/date";
import { apiRequest } from "../../api/transport";
import {
  TransactionTimePoint,
  transactionTimePointSchema,
} from "../../schema/portfolio-assets";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const useAssetTransactions = (
  assetId: string | undefined,
  startDate?: Date,
  endDate?: Date
) => {
  const assetTransactions = useQuery({
    queryKey: [...assetGraphTransactions, assetId, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await apiRequest<TransactionTimePoint[]>(
        "GET",
        `/api/assets/${assetId}/transactions/graph?${getDateUrlParams(
          startDate,
          endDate
        )}`
      );
      const result = transactionTimePointSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid asset transaction history response: ${result.error.message}`);
      }
      return result.data;
    },
    enabled: !!assetId,
  });

  return {
    assetTransactions,
  };
};
