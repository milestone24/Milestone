// AI_REVIEW_REQUIRED: Full module review required before further DB runtime changes, especially temp-table behavior in workers and distributed AWS Lambda execution.
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import {
  drizzle as drizzleNodePostgres,
  NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Client as PgClient, Pool } from "pg";
import ws from "ws";
import { sql } from "drizzle-orm";
import * as schema from "./schema/index.js";
import { noopLogger, type Logger } from "./types/logger.js";
export { Client as PgClient } from "pg";

type EndpointKind = "local" | "neon-direct" | "neon-pooler" | "unknown";
type ConnectionMode = "direct" | "pooled" | "unsupported";

interface DbRuntime {
  endpointKind: EndpointKind;
  connectionMode: ConnectionMode;
  supportsTransactions: boolean;
  supportsSessionConnection: boolean;
}

export interface DatabaseConnection {
  db: Database;
  isLocalDb: boolean;
  runtime: DbRuntime;
  ping: () => Promise<void>;
  withConnection: <T>(
    callback: (sessionDb: Database) => Promise<T>
  ) => Promise<T>;
}

function tryBuildDirectSessionUrlFromPooler(databaseUrl: string): string | null {
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("neon.tech") || !host.includes("-pooler.")) {
      return null;
    }

    // Neon pooler host: ep-<id>-pooler.<region>.aws.neon.tech
    // Direct host:      ep-<id>.<region>.aws.neon.tech
    parsed.hostname = host.replace("-pooler.", ".");

    // Strip pooling hints for the direct-session path.
    parsed.searchParams.delete("pgbouncer");
    parsed.searchParams.delete("pool_mode");

    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveEndpointKind(databaseUrl: string): EndpointKind {
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return "local";
    }
    if (host.includes("neon.tech")) {
      return host.includes("-pooler.") ? "neon-pooler" : "neon-direct";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Builds a database connection bound to the supplied logger.
 *
 * The logger is the single injection point for logging: any app or package
 * that creates a DB connection provides its own `Logger`, and the returned
 * `ping`/`withConnection` helpers close over it. Defaults to a no-op logger.
 */
export function createDatabaseConnection(
  logger: Logger = noopLogger
): DatabaseConnection {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }

  const endpointKind = resolveEndpointKind(databaseUrl);
  const isLocalDb = endpointKind === "local";
  const isKnownDeterministicEndpoint =
    endpointKind === "local" ||
    endpointKind === "neon-direct" ||
    endpointKind === "neon-pooler";
  const isSessionUnsafeEndpoint =
    !isKnownDeterministicEndpoint || endpointKind === "neon-pooler";
  const rewrittenDirectSessionUrl = tryBuildDirectSessionUrlFromPooler(databaseUrl);
  const canUseDirectRewriteForSessions =
    endpointKind === "neon-pooler" && !!rewrittenDirectSessionUrl;

  // Primary app db instance. Keep existing runtime behavior for non-local path.
  const db = (isLocalDb
    ? drizzleNodePostgres({
        connection: databaseUrl,
        schema,
      })
    : drizzleNeon({
        connection: databaseUrl,
        schema,
        ws: ws,
      })) as Database;

  // Session factories are explicit and typed to avoid fragile internal casts.
  // For pooler endpoints we intentionally disable session-scoped usage:
  // temp tables require session affinity that pooler endpoints generally do not guarantee.
  const runtime: DbRuntime = {
    endpointKind,
    connectionMode: isSessionUnsafeEndpoint
      ? "unsupported"
      : isLocalDb
        ? "pooled"
        : "direct",
    supportsTransactions: true,
    supportsSessionConnection:
      !isSessionUnsafeEndpoint || canUseDirectRewriteForSessions,
  };

  const localSessionPool = isLocalDb
    ? new Pool({
        connectionString: databaseUrl,
      })
    : null;

  const acquirePooledSessionClient =
    runtime.connectionMode === "pooled" && localSessionPool
      ? async () => {
          return await localSessionPool.connect();
        }
      : null;

  const directSessionConnectionString =
    canUseDirectRewriteForSessions && rewrittenDirectSessionUrl
      ? rewrittenDirectSessionUrl
      : !isSessionUnsafeEndpoint
        ? databaseUrl
        : null;

  const acquireDirectSessionClient = !isLocalDb && directSessionConnectionString
    ? async () => {
        const client = new PgClient({
          connectionString: directSessionConnectionString,
        });
        await client.connect();
        return client;
      }
    : null;

  logger.info(
    `DB runtime resolved endpointKind=${runtime.endpointKind} connectionMode=${runtime.connectionMode} supportsTransactions=${runtime.supportsTransactions} supportsSessionConnection=${runtime.supportsSessionConnection}`
  );

  const ping = async (): Promise<void> => {
    logger.info("Pinging database...");
    await db.execute(sql`SELECT 1`);
    logger.info("Database ping successful");
  };

  /**
   * Runs a callback with a single database connection (session) from the pool.
   * Use this when you need session-scoped state (e.g. temporary tables) so that
   * all operations run on the same connection until the callback completes.
   * The connection is exclusive to this callback until it returns: the pool does
   * not give the same connection to another caller until release(), so concurrent
   * withConnection callbacks never share a connection.
   * The connection is always released back to the pool (on success or throw).
   *
   * Design: persistence abstraction — callers get a session-scoped db without
   * touching pool/client APIs. Currently supported only for local (node-postgres)
   * driver; Neon path throws so temp-table flows use staging or local DB.
   */
  const withConnection = async <T>(
    callback: (sessionDb: Database) => Promise<T>
  ): Promise<T> => {
    if (!runtime.supportsSessionConnection) {
      throw new Error(
        `withConnection is not supported for this DB runtime (endpointKind=${runtime.endpointKind}, connectionMode=${runtime.connectionMode}). Temp-table workflows require a session-capable direct or pooled connection.`
      );
    }

    // If runtime mode is marked unsupported for the primary db path, but we have
    // an explicit direct-session acquisition path (e.g. Neon pooler -> rewritten direct URL),
    // use that path for temp-table-safe workflows.
    if (acquireDirectSessionClient && runtime.connectionMode === "unsupported") {
      const client = await acquireDirectSessionClient();
      try {
        const sessionDb = drizzleNodePostgres({
          client,
          schema,
        }) as Database;
        return await callback(sessionDb);
      } finally {
        await client.end();
      }
    }

    if (runtime.connectionMode === "pooled") {
      if (!acquirePooledSessionClient) {
        throw new Error(
          "withConnection pooled path misconfigured: session client acquisition is unavailable."
        );
      }
      const client = await acquirePooledSessionClient();
      try {
        const sessionDb = drizzleNodePostgres({
          client,
          schema,
        }) as Database;
        return await callback(sessionDb);
      } finally {
        client.release();
      }
    }

    if (runtime.connectionMode === "direct") {
      if (!acquireDirectSessionClient) {
        throw new Error(
          "withConnection direct path misconfigured: session client acquisition is unavailable."
        );
      }
      const client = await acquireDirectSessionClient();
      try {
        const sessionDb = drizzleNodePostgres({
          client,
          schema,
        }) as Database;
        return await callback(sessionDb);
      } finally {
        await client.end();
      }
    }

    throw new Error(
      `withConnection unsupported runtime path (endpointKind=${runtime.endpointKind}, connectionMode=${runtime.connectionMode}).`
    );
  };

  return {
    db,
    isLocalDb,
    runtime,
    ping,
    withConnection,
  };
}

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
