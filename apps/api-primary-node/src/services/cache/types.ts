export interface CacheOptions {
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Cache key prefix for namespacing */
  namespace?: string;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Cache statistics for observability
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  /** Hit rate as a percentage (0-100) */
  hitRate: number;
}

/**
 * Cache provider interface - both local and distributed implementations satisfy this
 */
export interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(namespace?: string): Promise<void>;
  getStats(): CacheStats;
}

/**
 * Configuration for the cache factory
 */
export interface CacheConfig {
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Max entries for local cache (LRU eviction) */
  maxSize?: number;
  /** Redis connection string (for distributed) */
  connectionString?: string;
}

/**
 * Options for cacheable wrapper
 */
export interface CacheableOptions<
  TArgs extends unknown[],
  N extends string = string
> {
  /** Function to generate cache key from arguments */
  keyGenerator: (...args: TArgs) => `${N}:${string}`;
  /** Cache namespace */
  namespace: N;
  /** TTL in milliseconds (overrides default) */
  ttl?: number;
}
