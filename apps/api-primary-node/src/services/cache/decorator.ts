import { getCacheProvider } from "./provider";
import { CacheOptions } from "./types";
import { hasRequestContext } from "@/context/request-context";

export interface CachedOptions<TArgs extends unknown[], N extends string = string>
  extends Omit<CacheOptions, "namespace"> {
  /** Function to generate cache key from method arguments */
  keyGenerator: (...args: TArgs) => `${N}:${string}`;
  /** Cache namespace (must match the key prefix) */
  namespace: N;
}

/**
 * Method decorator that adds caching to async methods.
 * Uses TC39 Stage 3 decorators (TypeScript 5.0+).
 *
 * @example
 * ```typescript
 * class MyService {
 *   @Cached({
 *     namespace: "my-cache",
 *     keyGenerator: (id, query) => buildCacheKey("my-cache", id, queryParamsToKey(query)),
 *     ttl: 5 * 60 * 1000, // optional, uses default if omitted
 *   })
 *   async getDataById(id: string, query?: QueryParams): Promise<Data[]> {
 *     // implementation
 *   }
 * }
 * ```
 */
export function Cached<TArgs extends unknown[], TResult, N extends string>(
  options: CachedOptions<TArgs, N>
) {
  return function <This>(
    target: (this: This, ...args: TArgs) => Promise<TResult>,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: TArgs) => Promise<TResult>
    >
  ) {
    return async function (this: This, ...args: TArgs): Promise<TResult> {
      // Cache is only valid inside request AsyncLocalStorage context
      if (!hasRequestContext()) {
        return target.call(this, ...args);
      }

      const cache = getCacheProvider();
      const key = options.keyGenerator(...args);

      // Check cache first
      const cached = await cache.get<TResult>(key);

      if (cached !== undefined) {
        return cached;
      }

      // Execute original method
      const result = await target.call(this, ...args);

      // Cache the result
      await cache.set(key, result, {
        ttl: options.ttl,
        namespace: options.namespace,
      });

      return result;
    };
  };
}
