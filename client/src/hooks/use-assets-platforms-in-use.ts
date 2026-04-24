import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/queryClient";
import { assetsBrokerPlatformsInUse } from "@shared/api/queryKeys";
import {
  brokerPlatformsInUseResponseSchema,
  type BrokerPlatformInUseItem,
} from "@shared/schema";
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
