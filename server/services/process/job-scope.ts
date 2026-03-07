/**
 * Job-scope disposable for distributed handlers: ensures shutdown unregistration
 * and queue unsubscribe run when the handler scope exits (e.g. via `await using`).
 * Cleanup is idempotent — safe to run more than once. Used by asset-values and
 * securities-cache distributed handlers.
 */
export type JobScopeCleanup = {
  unregisterShutdown: () => void;
  unsubscribe: () => void;
};

/**
 * Creates an async disposable that runs the given cleanup when the scope exits.
 * Use with `await using jobScope = createJobScope(...)` so unregisterShutdown
 * and unsubscribe are always called, allowing GC of listeners and subscriptions.
 */
export function createJobScope(cleanup: JobScopeCleanup): AsyncDisposable {
  let disposed = false;
  return {
    async [Symbol.asyncDispose](): Promise<void> {
      if (disposed) return;
      disposed = true;
      cleanup.unregisterShutdown();
      cleanup.unsubscribe();
    },
  };
}
