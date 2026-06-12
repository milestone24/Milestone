import { useSession } from "./use-session";
import { getDateUrlParams } from "../../utils/date";
import { apiRequest } from "../../api/transport";
import { portfolioAssets } from "../../api/queryKeys";
import {
  UserAssetWithValueChange,
  userAssetWithValueChangeSchema,
} from "../../schema";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";

export const useAssets = (startDate?: Date, endDate?: Date) => {
  const { user, isSessionPending } = useSession();
  const apiEnabled = !isSessionPending && !!user;

  return useQuery<UserAssetWithValueChange[]>({
    queryKey: [...portfolioAssets, startDate, endDate],
    placeholderData: keepPreviousData,
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
