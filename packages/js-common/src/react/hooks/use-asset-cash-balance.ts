import { assetCashBalance } from "../../api/queryKeys";
import { apiRequest } from "../../api/transport";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const cashBalanceResponseSchema = z.object({
  balance: z.string(),
});

export const useAssetCashBalance = (assetId: string | undefined) => {
  const query = useQuery({
    queryKey: [...assetCashBalance, assetId],
    queryFn: async () => {
      const data = await apiRequest<unknown>(
        "GET",
        `/api/assets/${assetId}/cash-balance`
      );
      const parsed = cashBalanceResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`Invalid cash balance response: ${parsed.error.message}`);
      }
      return parsed.data;
    },
    enabled: !!assetId,
  });

  return { cashBalance: query };
};
