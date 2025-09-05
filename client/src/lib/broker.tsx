import { BrokerLogo } from "@/components/logo/BrokerLogo";
import {
  BrokerPlatform,
  BrokerProvider,
} from "@shared/schema/portfolio-assets";

export const getBrokerName = (
  platformId: string,
  brokerPlatforms: BrokerPlatform[]
) => {
  const provider = brokerPlatforms?.find((p) => p.id === platformId);
  return provider ? provider.name : "Unknown";
};

export const getBrokerSlug = (
  platformId: string,
  brokerPlatforms: BrokerPlatform[]
) => {
  const provider = brokerPlatforms?.find((p) => p.id === platformId);
  return provider
    ? resolveBrokerSlug(getBrokerName(platformId, brokerPlatforms))
    : "unknown";
};

export const getBrokerSlugFromName = (providerName: string) => {
  return resolveBrokerSlug(providerName);
};

export const resolveBrokerSlug = (providerName: string) => {
  switch (providerName.toLowerCase()) {
    case "trading 212":
    case "trading212":
      return "trading212";
    case "vanguard":
      return "vanguard";
    case "invest engine":
    case "investengine":
      return "invest-engine";
    case "hargreaves lansdown":
      return "hargreaves-lansdown";
    case "aj bell":
      return "aj-bell";
    default:
      return "unknown";
  }
};

export const getBrokerAccountTypeFullName = (accountType: string) => {
  return accountType === "LISA"
    ? "Lifetime ISA"
    : accountType === "GIA"
    ? "General Account"
    : accountType === "CISA"
    ? "Cash ISA"
    : accountType;
};
