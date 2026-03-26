import { BrokerPlatform } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export const brokerPlatformsQueryKey = ["/api/assets/broker-platforms"];

const THIRTY_MINUTES = 30 * 60 * 1000;

export const useBrokerPlatforms = () => {
  return useQuery<BrokerPlatform[]>({
    queryKey: brokerPlatformsQueryKey,
    queryFn: async () =>
      await apiRequest("GET", "/api/assets/broker-platforms"),
    gcTime: THIRTY_MINUTES,
  });
};
