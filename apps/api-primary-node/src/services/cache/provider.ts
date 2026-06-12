import { CacheProvider, CacheConfig } from "./types";
import { LocalCacheProvider } from "./local";
import { DistributedCacheProvider } from "./distributed";

/** Default TTL: 5 minutes in milliseconds */
const DEFAULT_TTL = 5 * 60 * 1000;

/** Default max cache size (local cache only) */
const DEFAULT_MAX_SIZE = 1000;

/** Singleton cache provider instance */
let cacheProviderInstance: CacheProvider | null = null;

type CacheProviderType = "local" | "distributed";

/**
 * Gets the cache provider type from environment variable
 * Defaults to 'local' if not set or invalid
 */
function getCacheProviderType(): CacheProviderType {
  const envProvider = process.env.CACHE_PROVIDER?.toLowerCase();
  if (envProvider === "distributed") {
    return "distributed";
  }
  return "local";
}

/**
 * Creates a cache provider based on configuration
 *
 * Environment variables:
 * - CACHE_PROVIDER: 'local' | 'distributed' (default: local)
 *
 * For distributed (Redis):
 * - REDIS_HOST: Redis host (default: localhost)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 * - REDIS_URL: Full Redis connection URL (alternative to individual vars)
 */
export function createCacheProvider(config?: CacheConfig): CacheProvider {
  const providerType = getCacheProviderType();

  switch (providerType) {
    case "distributed":
      return new DistributedCacheProvider({
        connectionString: config?.connectionString ?? process.env.REDIS_URL,
        defaultTtl: config?.defaultTtl ?? DEFAULT_TTL,
        keyPrefix: "milestone:cache:",
      });

    case "local":
    default:
      return new LocalCacheProvider({
        maxSize: config?.maxSize ?? DEFAULT_MAX_SIZE,
        defaultTtl: config?.defaultTtl ?? DEFAULT_TTL,
      });
  }
}

/**
 * Gets the singleton cache provider instance
 * Creates it on first call using environment configuration
 */
export function getCacheProvider(): CacheProvider {
  if (!cacheProviderInstance) {
    cacheProviderInstance = createCacheProvider();
  }
  return cacheProviderInstance;
}

/**
 * Resets the singleton cache provider (useful for testing)
 */
export function resetCacheProvider(): void {
  cacheProviderInstance = null;
}
