import type { BrokerPlatform } from "../schema/portfolio-assets";

export const getPlatformName = (
  platformId: string,
  platforms: BrokerPlatform[],
) => {
  const provider = platforms?.find((p) => p.id === platformId);
  return provider ? provider.name : "Unknown";
};

export const getPlatformSlug = (
  platformId: string,
  platforms: BrokerPlatform[],
) => {
  const provider = platforms?.find((p) => p.id === platformId);
  return provider
    ? resolvePlatformSlug(getPlatformName(platformId, platforms))
    : "unknown";
};

export const getPlatformSlugFromName = (platformName: string) => {
  return resolvePlatformSlug(platformName);
};

export const resolvePlatformSlug = (platformName: string) => {
  switch (platformName.toLowerCase()) {
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

export const getAccountTypeFullName = (accountType: string) => {
  return accountType === "LISA"
    ? "Lifetime ISA"
    : accountType === "GIA"
      ? "General Account"
      : accountType === "CISA"
        ? "Cash ISA"
        : accountType;
};
