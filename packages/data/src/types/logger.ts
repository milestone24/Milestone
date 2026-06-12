/**
 * Logging contract the data layer depends on.
 *
 * The data package never ships a concrete logging implementation. Any app or
 * package that creates a database connection injects its own `Logger`, so the
 * lowest-level data layer stays free of upstream logging concerns.
 */
export interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
}

/** Silent default used when no logger is injected. */
export const noopLogger: Logger = {
  log() {},
  error() {},
  warn() {},
  info() {},
  debug() {},
};
