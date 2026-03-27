import { brokerPlatformSchema, BrokerPlatform } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export const brokerPlatformsQueryKey = ["/api/assets/broker-platforms"];

const THIRTY_MINUTES = 30 * 60 * 1000;

export const brokerPlatformsQueryFn = async (): Promise<BrokerPlatform[]> => {
  const data = await apiRequest("GET", "/api/assets/broker-platforms");
  const result = brokerPlatformSchema.array().safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid broker platforms response: ${result.error.message}`);
  }
  return result.data;
};

export const useBrokerPlatforms = () => {
  return useQuery<BrokerPlatform[]>({
    queryKey: brokerPlatformsQueryKey,
    queryFn: brokerPlatformsQueryFn,
    gcTime: THIRTY_MINUTES,
  });
};
