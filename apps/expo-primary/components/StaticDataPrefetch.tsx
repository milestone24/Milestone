import { useEffect } from "react";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import {
  brokerPlatformsQueryFn,
  brokerPlatformsQueryKey,
} from "@milestone/js-common/react/hooks/use-broker-platforms";
import { queryClient } from "@/lib/api";

export function StaticDataPrefetch() {
  const { isAuthenticated } = useSession();

  useEffect(() => {
    if (!isAuthenticated) return;
    void queryClient.prefetchQuery({
      queryKey: brokerPlatformsQueryKey,
      queryFn: brokerPlatformsQueryFn,
    });
  }, [isAuthenticated]);

  return null;
}
