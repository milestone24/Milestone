import { assetGraphTransactions } from "@shared/api/queryKeys";
import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import {
  ResolvedUserAsset,
  TransactionTimePoint,
} from "@shared/schema/portfolio-assets";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const useAssetTransactions = (
  assetId: string | undefined,
  startDate?: Date,
  endDate?: Date
) => {
  const assetTransactions = useQuery({
    queryKey: [...assetGraphTransactions, assetId, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: () => {
      return apiRequest<TransactionTimePoint[]>(
        "GET",
        `/api/assets/${assetId}/transactions/graph?${getDateUrlParams(
          startDate,
          endDate
        )}`
      );
    },
    enabled: !!assetId,
  });

  return {
    assetTransactions,
  };
};
