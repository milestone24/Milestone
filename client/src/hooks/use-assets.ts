import { useSession } from "@/hooks/use-session";
import { getDateUrlParams } from "@/lib/date";
import { apiRequest } from "@/lib/queryClient";
import { portfolioAssets } from "@shared/api/queryKeys";
import {
  UserAssetWithValueChange,
  userAssetWithValueChangeSchema,
} from "@shared/schema";
import { skipToken, useQuery } from "@tanstack/react-query";

export const useAssets = (startDate?: Date, endDate?: Date) => {
  const { user, isSessionPending } = useSession();
  const apiEnabled = !isSessionPending && !!user;

  return useQuery<UserAssetWithValueChange[]>({
    queryKey: [...portfolioAssets, startDate, endDate],
    queryFn: apiEnabled
      ? async () => {
          const response = await apiRequest<UserAssetWithValueChange[]>(
            "GET",
            `/api/assets?${getDateUrlParams(startDate, endDate)}`
          );
          const result = userAssetWithValueChangeSchema
            .array()
            .safeParse(response);

          if (!result.success) {
            console.log("useAssets result", result.error);
            throw new Error("Invalid assets result");
          }

          return result.data;
        }
      : skipToken,
  });
};
