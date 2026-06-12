import { useSession } from "./use-session";
import { apiRequest } from "../../api/transport";
import { assetsBrokerPlatformsInUse } from "../../api/queryKeys";
import {
  brokerPlatformsInUseResponseSchema,
  type BrokerPlatformInUseItem,
} from "../../schema";
import { skipToken, useQuery } from "@tanstack/react-query";

export function useAssetsPlatformsInUse() {
  const { user, isSessionPending } = useSession();
  const enabled = !isSessionPending && !!user;

  return useQuery<BrokerPlatformInUseItem[]>({
    queryKey: assetsBrokerPlatformsInUse,
    queryFn: enabled
      ? async () => {
          const response = await apiRequest<unknown>(
            "GET",
            "/api/assets/platforms-in-use"
          );
          const result = brokerPlatformsInUseResponseSchema.safeParse(response);
          if (!result.success) {
            throw new Error("Invalid platforms in use result");
          }
          return result.data;
        }
      : skipToken,
  });
}
