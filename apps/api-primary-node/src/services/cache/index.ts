import { CacheProvider, CacheableOptions, CacheStats } from "./types";
import { getCacheProvider } from "./provider";
import { hasRequestContext } from "@/context/request-context";

export * from "./types";
export * from "./utils";
export * from "./provider";
export * from "./decorator";
export * from "./invalidation-decorator";

/**
 * Wraps a function with caching capabilities
 *
 * @param fn - The async function to wrap with caching
 * @param options - Caching configuration options
 * @param provider - Optional cache provider (uses singleton if not provided)
 * @returns A cached version of the function
 *
 * @example
 * ```typescript
 * const cachedGetHistory = cacheable(
 *   this.getUserAssetHistoryWithBoundary.bind(this),
 *   {
 *     namespace: 'asset-history',
 *     keyGenerator: (assetId, query) =>
 *       buildCacheKey('asset-history', assetId, queryParamsToKey(query)),
 *     ttl: 5 * 60 * 1000, // 5 minutes
 *   }
 * );
 * ```
 */
export function cacheable<TArgs extends unknown[], TResult, N extends string>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CacheableOptions<TArgs, N>,
  provider?: CacheProvider
): (...args: TArgs) => Promise<TResult> {
  const cache = provider ?? getCacheProvider();

  return async (...args: TArgs): Promise<TResult> => {
    // Cache is only valid inside request AsyncLocalStorage context
    if (!hasRequestContext()) {
      return fn(...args);
    }

    const key = options.keyGenerator(...args);

    // Check cache first
    const cached = await cache.get<TResult>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(key, result, {
      ttl: options.ttl,
      namespace: options.namespace,
    });

    return result;
  };
}

/**
 * Invalidates all cache entries for one or more namespaces
 *
 * @param namespaces - Single namespace or array of namespaces to clear
 * @param provider - Optional cache provider (uses singleton if not provided)
 */
export async function invalidateCache(
  namespaces?: string | string[],
  provider?: CacheProvider
): Promise<void> {
  const cache = provider ?? getCacheProvider();

  // Clear all cache entries when namespaces is omitted or empty.
  if (
    namespaces === undefined ||
    (Array.isArray(namespaces) && namespaces.length === 0)
  ) {
    await cache.clear();
    return;
  }

  const namespacesToClear = Array.isArray(namespaces)
    ? namespaces
    : [namespaces];

  await Promise.all(namespacesToClear.map((ns) => cache.clear(ns)));
}

/**
 * Gets cache statistics for observability
 *
 * @param provider - Optional cache provider (uses singleton if not provided)
 * @returns Cache statistics including hits, misses, size, and hit rate
 */
export function getCacheStats(provider?: CacheProvider): CacheStats {
  const cache = provider ?? getCacheProvider();
  return cache.getStats();
}
