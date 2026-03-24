import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
//import { drizzle as drizzleNeonWebsockets } from "drizzle-orm/neon-websockets";
import {
  drizzle as drizzleNodePostgres,
  NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Client as PgClient, Pool } from "pg";
import ws from "ws";
import * as schema from "./schema/index";
import { sql } from "drizzle-orm";
import { log, error, warn, info, debug } from "../log";
export { Client as PgClient } from "pg";

import { DefaultLogger, LogWriter } from "drizzle-orm/logger";
class MyLogWriter implements LogWriter {
  write(message: string) {
    log(message);
  }
  error(message: string) {
    error(message);
  }
  warn(message: string) {
    warn(message);
  }
  info(message: string) {
    info(message);
  }
  debug(message: string) {
    debug(message);
  }
}
const logger = new DefaultLogger({ writer: new MyLogWriter() });

type EndpointKind =
  | "local"
  | "neon-direct"
  | "neon-pooler"
  | "pooled-url"
  | "unknown";
type ConnectionMode = "direct" | "pooled" | "unsupported";

interface DbRuntime {
  endpointKind: EndpointKind;
  connectionMode: ConnectionMode;
  supportsTransactions: boolean;
  supportsSessionConnection: boolean;
}

interface DatabaseConnection {
  db: Database;
  isLocalDb: boolean;
  runtime: DbRuntime;
  acquirePooledSessionClient: (() => Promise<PgClient>) | null;
  acquireDirectSessionClient: (() => Promise<PgClient>) | null;
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
    const pgbouncerHint =
      parsed.searchParams.get("pgbouncer")?.toLowerCase() === "true";
    const poolMode = parsed.searchParams.get("pool_mode")?.toLowerCase();
    const pooledUrlHint =
      pgbouncerHint || poolMode === "transaction" || poolMode === "statement";

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return "local";
    }
    if (host.includes("neon.tech")) {
      return host.includes("-pooler.") ? "neon-pooler" : "neon-direct";
    }
    if (pooledUrlHint) {
      return "pooled-url";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function createDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }

  const endpointKind = resolveEndpointKind(databaseUrl);
  const isLocalDb = endpointKind === "local";
  const isSessionUnsafeEndpoint =
    endpointKind === "neon-pooler" || endpointKind === "pooled-url";
  const rewrittenDirectSessionUrl = tryBuildDirectSessionUrlFromPooler(databaseUrl);
  const canUseDirectRewriteForSessions =
    endpointKind === "neon-pooler" && !!rewrittenDirectSessionUrl;

  // Primary app db instance. Keep existing runtime behavior for non-local path.
  const db = (isLocalDb
    ? drizzleNodePostgres({
        connection: databaseUrl,
        schema,
        //logger
      })
    : drizzleNeon({
        //connection: databaseUrl?.replace('.us-east-2', '-pooler.us-east-2');,
        connection: databaseUrl,
        schema,
        //logger,
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

  info(
    `DB runtime resolved endpointKind=${runtime.endpointKind} connectionMode=${runtime.connectionMode} supportsTransactions=${runtime.supportsTransactions} supportsSessionConnection=${runtime.supportsSessionConnection}`
  );

  return {
    db,
    isLocalDb,
    runtime,
    acquirePooledSessionClient,
    acquireDirectSessionClient,
  };
}

// Create a singleton instance
const {
  db,
  isLocalDb,
  runtime,
  acquirePooledSessionClient,
  acquireDirectSessionClient,
} =
  createDatabaseConnection();

const ping = async () => {
  console.log("Pinging database...");
  const pingResult = await db.execute(sql`SELECT 1`);
  console.log("Database ping successful:");
};

export { db, isLocalDb, ping };
export const dbRuntime = runtime;

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
export async function withConnection<T>(
  callback: (sessionDb: Database) => Promise<T>
): Promise<T> {
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
}

//export type Database = typeof db;
export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
