/**
 * Centralised process signal coordinator for graceful shutdown.
 *
 * ## Why this exists
 * Node.js automatically exits on SIGTERM/SIGINT only when NO custom handler is registered.
 * The moment any code calls `process.on("SIGTERM", ...)`, Node delegates full responsibility
 * for the exit to the application. Without an explicit `process.exit()`, the event loop stays
 * alive indefinitely — kept open by long-lived handles such as database connection pools.
 *
 * Rather than each service registering its own signal listeners (which causes hidden
 * `process.exit()` calls scattered across the codebase and makes it impossible to reason
 * about shutdown ordering), this module is the single owner of SIGTERM and SIGINT for the
 * entire process. Services register cleanup callbacks via `registerShutdownHandler` and this
 * module calls `process.exit()` once all of them have completed.
 *
 * ## Handler registry
 * Handlers are stored per signal key in a Map. The supported keys are:
 *
 * - `"SIGTERM"` — runs only when SIGTERM is received.
 * - `"SIGINT"`  — runs only when SIGINT is received.
 * - `"ALL"`     — runs on either signal. This is the implicit key used when no signal is
 *                 specified in `registerShutdownHandler(handler)`.
 *
 * When a signal fires, the signal-specific set and the "ALL" set are merged and run in
 * parallel. The entire map is then cleared atomically, preventing any handler from being
 * invoked twice regardless of how many signals arrive.
 *
 * ## The npm duplicate signal problem
 * When CTRL+C is pressed in a terminal, the OS sends SIGINT to the entire foreground process
 * group. This means both `npm` and its child process (tsx/node) receive the signal directly.
 * npm then also *forwards* the signal to its child. The result is that the node process
 * receives SIGINT **twice** in rapid succession (typically within single-digit milliseconds).
 *
 * Without a guard, the second signal would find the handler map already cleared by the first,
 * skip cleanup entirely, and call `process.exit(0)` while the first signal's async cleanup is
 * still in progress — leaving jobs in a `running` state in the database.
 *
 * ## Two-strike approach
 * To handle the duplicate safely while preserving the ability to force-exit if cleanup hangs:
 *
 * - First signal: records the timestamp in `exitingAt` and starts graceful cleanup.
 * - Second signal within DUPLICATE_SIGNAL_WINDOW_MS: treated as the npm-forwarded duplicate,
 *   ignored silently.
 * - Second signal after DUPLICATE_SIGNAL_WINDOW_MS: treated as a deliberate force-exit from
 *   the user (cleanup is hanging), calls `process.exit(1)`.
 *
 * The 500ms window is empirical. The npm-forwarded duplicate reliably arrives in <10ms.
 * A genuine second CTRL+C from a human would arrive well over 500ms after the first.
 * The only edge case is an extremely resource-starved system where npm's forwarding is delayed
 * beyond 500ms — in that scenario the duplicate would trigger a force-exit, which is no worse
 * than the unguarded behaviour.
 *
 * ## Coordinator-level timeout
 * Each handler declares its own timeout via the options argument of `registerShutdownHandler`
 * (defaulting to DEFAULT_SHUTDOWN_TIMEOUT_MS = 30s). At signal time the coordinator calculates
 * Math.max of all registered handler timeouts and uses that as the single overall deadline for
 * the Promise.race. This ensures the coordinator never cuts off a handler that legitimately
 * needs more time than the default, and never waits longer than it needs to.
 *
 * Call sites that want cohesion with the default can import DEFAULT_SHUTDOWN_TIMEOUT_MS and
 * use it to size their own internal retry/polling logic.
 *
 * ## Exit codes
 * - `process.exit(0)` — all handlers completed successfully.
 * - `process.exit(1)` — a handler threw an error, the timeout was exceeded, or the user
 *   force-exited with a second signal after DUPLICATE_SIGNAL_WINDOW_MS.
 */

type ShutdownHandler = (signal: string) => Promise<void>;

type SignalKey = "SIGINT" | "SIGTERM" | "ALL";

/** Options for an individual shutdown handler registration. */
export type ShutdownHandlerOptions = {
  /**
   * Maximum time in milliseconds this handler is allowed to run.
   * Defaults to DEFAULT_SHUTDOWN_TIMEOUT_MS.
   * The coordinator uses Math.max of all registered handler timeouts as the overall deadline.
   */
  timeout?: number;
};

type HandlerEntry = {
  fn: ShutdownHandler;
  timeout: number;
};

/**
 * Time window within which a second signal is treated as an npm-forwarded duplicate
 * rather than a deliberate force-exit from the user.
 */
const DUPLICATE_SIGNAL_WINDOW_MS = 500;

/**
 * Default maximum time allowed for a shutdown handler to complete.
 * Exported so call sites can size their own internal cleanup logic in cohesion with the
 * coordinator's deadline rather than hardcoding a separate value.
 */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

const handlersBySignal = new Map<SignalKey, Set<HandlerEntry>>();

const getOrCreateSet = (key: SignalKey): Set<HandlerEntry> => {
  if (!handlersBySignal.has(key)) handlersBySignal.set(key, new Set());
  return handlersBySignal.get(key)!;
};

/** Timestamp of the first signal received. Null if no signal has been received yet. */
let exitingAt: number | null = null;

const onSignal = async (signal: string) => {
  const now = Date.now();

  if (exitingAt !== null) {
    const elapsed = now - exitingAt;
    if (elapsed < DUPLICATE_SIGNAL_WINDOW_MS) {
      console.log(`${signal} received ${elapsed}ms after first signal, treating as duplicate, ignoring`);
      return;
    }
    console.log(`${signal} received ${elapsed}ms after first signal, forcing exit`);
    process.exit(1);
  }

  exitingAt = now;

  const signalEntries = [...(handlersBySignal.get(signal as SignalKey) ?? [])];
  const allEntries = [...(handlersBySignal.get("ALL") ?? [])];
  const currentEntries = [...signalEntries, ...allEntries];
  handlersBySignal.clear();

  console.log(`${signal} received, ${currentEntries.length} shutdown handler(s) registered`);

  let failed = false;

  if (currentEntries.length > 0) {
    const coordinatorTimeout = Math.max(...currentEntries.map((e) => e.timeout));

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Shutdown timed out after ${coordinatorTimeout}ms`)),
        coordinatorTimeout
      )
    );

    console.log(`${signal} coordinator timeout set to ${coordinatorTimeout}ms`);

    try {
      await Promise.race([
        Promise.all(
          currentEntries.map(async (entry, i) => {
            console.log(`${signal} starting handler ${i + 1} of ${currentEntries.length} (timeout: ${entry.timeout}ms)`);
            await entry.fn(signal);
            console.log(`${signal} handler ${i + 1} of ${currentEntries.length} completed`);
          })
        ),
        timeout,
      ]);
      console.log(`${signal} all shutdown handlers completed`);
    } catch (error) {
      console.error(`${signal} shutdown handler error:`, error);
      failed = true;
    }
  }

  console.log(`${signal} exiting process${failed ? " with errors" : ""}`);
  process.exit(failed ? 1 : 0);
};

process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("SIGINT", () => onSignal("SIGINT"));

/**
 * Registers an async cleanup callback to be invoked when the process receives a shutdown signal.
 *
 * Two signatures are supported:
 *
 * - `registerShutdownHandler(handler)` — runs on ANY signal (SIGTERM or SIGINT). Use this in
 *   most cases where the cleanup is signal-agnostic.
 * - `registerShutdownHandler(signal, handler)` — runs only when the specified signal is
 *   received. Use this when behaviour needs to differ per signal.
 *
 * The handler receives the signal name as its argument so signal-agnostic handlers can
 * still inspect it if needed.
 *
 * All registered handlers run in parallel. The process exits only after all handlers complete.
 *
 * Returns an unregister function. Callers MUST invoke it when their work completes normally
 * (i.e. not via a signal) to prevent a stale handler from being invoked on a future signal.
 *
 * An optional `options` object can be passed as the last argument to configure the handler:
 * - `timeout` — overrides the default handler timeout. The coordinator will use the maximum
 *   timeout across all registered handlers as the overall deadline, so setting a higher value
 *   here ensures the coordinator waits long enough for this handler to complete.
 *
 * @example
 * // Signal-agnostic (most common case):
 * const unregister = registerShutdownHandler(async (signal) => {
 *   abortController.abort();
 *   await waitForJobToAbort();
 * });
 * unregister(); // call when job completes normally
 *
 * @example
 * // Signal-agnostic with custom timeout:
 * const unregister = registerShutdownHandler(
 *   async (signal) => { await longCleanup(); },
 *   { timeout: 60_000 }
 * );
 *
 * @example
 * // Signal-specific:
 * const unregister = registerShutdownHandler("SIGTERM", async () => {
 *   await drainOperation();
 * });
 * unregister();
 */
export function registerShutdownHandler(handler: ShutdownHandler, options?: ShutdownHandlerOptions): () => void;
export function registerShutdownHandler(signal: Exclude<SignalKey, "ALL">, handler: ShutdownHandler, options?: ShutdownHandlerOptions): () => void;
export function registerShutdownHandler(
  signalOrHandler: Exclude<SignalKey, "ALL"> | ShutdownHandler,
  handlerOrOptions?: ShutdownHandler | ShutdownHandlerOptions,
  options?: ShutdownHandlerOptions
): () => void {
  const key: SignalKey = typeof signalOrHandler === "string" ? signalOrHandler : "ALL";
  const fn: ShutdownHandler = typeof signalOrHandler === "function" ? signalOrHandler : handlerOrOptions as ShutdownHandler;
  const opts: ShutdownHandlerOptions | undefined = typeof signalOrHandler === "function"
    ? handlerOrOptions as ShutdownHandlerOptions
    : options;
  const entry: HandlerEntry = { fn, timeout: opts?.timeout ?? DEFAULT_SHUTDOWN_TIMEOUT_MS };
  const set = getOrCreateSet(key);
  set.add(entry);
  return () => set.delete(entry);
}
