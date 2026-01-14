import { getCacheProvider } from "./provider";
import { buildCacheKey } from "./utils";
import { getUserAccountId, hasRequestContext } from "@server/context/request-context";

export type InvalidationScope = "global" | "account";

export interface InvalidatesCacheOptions {
  /**
   * Cache namespaces to invalidate.
   *
   * - global scope: clears `${namespace}:*`
   * - account scope: clears `${namespace}:${userAccountId}:*` (derived from AsyncLocalStorage request context)
   */
  namespaces: readonly string[];
  /**
   * - "account" (default): prefer account-scoped invalidation when request context exists
   * - "global": always clear the full namespace
   */
  scope?: InvalidationScope;
}

/**
 * Method decorator that invalidates cache entries after a successful mutation.
 * Uses TC39 Stage 3 decorators (TypeScript 5.0+).
 *
 * Important:
 * - Invalidates only on success (throws propagate without invalidation)
 * - If scope is "account" but no request context exists, invalidation is skipped.
 */
export function InvalidatesCache<TArgs extends unknown[], TResult>(
  options: InvalidatesCacheOptions
) {
  return function <This>(
    target: (this: This, ...args: TArgs) => Promise<TResult>,
    _context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: TArgs) => Promise<TResult>
    >
  ) {
    return async function (this: This, ...args: TArgs): Promise<TResult> {
      const result = await target.call(this, ...args);

      const cache = getCacheProvider();
      const namespaces = options.namespaces;

      const scope = options.scope ?? "account";
      const canUseAccountScope = scope === "account" && hasRequestContext();

      if (canUseAccountScope) {
        const userAccountId = getUserAccountId();
        const prefixes = namespaces.map((ns) => buildCacheKey(ns, userAccountId));
        await Promise.all(prefixes.map((p) => cache.clear(p)));
      } else if (scope === "global") {
        await Promise.all(namespaces.map((ns) => cache.clear(ns)));
      }

      return result;
    };
  };
}

