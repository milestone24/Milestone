import { assetFlatTransactions } from "@shared/api/queryKeys";
import { apiRequest } from "@/lib/queryClient";
import {
  flatCombinedTransactionRowSchema,
  type FlatCombinedTransactionRow,
} from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

/**
 * Full-history flat list of merged cash (`asset_transactions`) and security rows for a calculated asset.
 * Does not use the global date range (v1).
 */
export const useCalculatedAssetTransactions = (assetId: string | undefined) => {
  const query = useQuery({
    queryKey: [...assetFlatTransactions, assetId],
    queryFn: async (): Promise<FlatCombinedTransactionRow[]> => {
      const data = await apiRequest<unknown>(
        "GET",
        `/api/assets/${assetId}/transactions?sort=valueDate,desc`
      );
      const parsed = flatCombinedTransactionRowSchema.array().safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Invalid flat transactions response: ${parsed.error.message}`
        );
      }
      return parsed.data;
    },
    enabled: !!assetId,
  });

  return { flatTransactions: query };
};
