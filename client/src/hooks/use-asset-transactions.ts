import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import {
  ResolvedUserAsset,
  TransactionTimePoint,
} from "@shared/schema/portfolio-assets";
import { useQuery } from "@tanstack/react-query";

export const useAssetTransactions = (
  assetId: string | undefined,
  startDate?: Date,
  endDate?: Date
) => {
  const assetTransactions = useQuery({
    queryKey: ["asset-transactions", assetId, startDate, endDate],
    queryFn: () => {
      return apiRequest<TransactionTimePoint[]>(
        "GET",
        `/api/assets/${assetId}/transactions/graph?${getDateUrlParams(
          startDate,
          endDate
        )}`
      );
    },
  });

  return {
    assetTransactions,
  };
};
