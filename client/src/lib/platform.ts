import { BrokerPlatform } from "@shared/schema";

export const getPlatformName = (
  platformId: string,
  brokerPlatforms: BrokerPlatform[]
) => {
  const provider = brokerPlatforms?.find((p) => p.id === platformId);
  return provider ? provider.name : "Unknown";
};
