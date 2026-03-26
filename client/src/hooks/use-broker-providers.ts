import { BrokerProvider } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export const brokerProvidersQueryKey = ["/api/assets/broker-providers"];

const THIRTY_MINUTES = 30 * 60 * 1000;

export const useBrokerProviders = () => {
  return useQuery<BrokerProvider[]>({
    queryKey: brokerProvidersQueryKey,
    queryFn: async () =>
      await apiRequest("GET", "/api/assets/broker-providers"),
    gcTime: THIRTY_MINUTES,
  });
};
