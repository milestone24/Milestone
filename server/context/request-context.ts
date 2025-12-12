import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  userAccountId: string;
}

// Singleton AsyncLocalStorage instance
const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current userAccountId from request context.
 * Throws if called outside of an authenticated request.
 */
export function getUserAccountId(): string {
  const ctx = requestContext.getStore();
  if (!ctx) {
    throw new Error("getUserAccountId() called outside of request context");
  }
  return ctx.userAccountId;
}

/**
 * Check if we're inside a request context
 */
export function hasRequestContext(): boolean {
  return requestContext.getStore() !== undefined;
}

/**
 * Run a callback with request context established.
 * Used by auth middleware.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

export { requestContext };
