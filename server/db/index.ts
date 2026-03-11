import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import {
  drizzle as drizzleNodePostgres,
  NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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

export function createDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }

  // Check if we're using a local Neon database
  const isLocalDb = /127.0.0.1|localhost/.test(databaseUrl);

  const db = isLocalDb
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
        // poolConfig: {
        //   maxConns: 5,
        //   maxIdleTimeMs: 30000,
        //   connectionTimeoutMs: 10000
        // }
      });

  return {
    db,
    isLocalDb,
  };
}

// Create a singleton instance
const { db, isLocalDb } = createDatabaseConnection();

const ping = async () => {
  console.log("Pinging database...");
  const pingResult = await db.execute(sql`SELECT 1`);
  console.log("Database ping successful:");
};

export { db, isLocalDb, ping };

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
  if (!isLocalDb) {
    throw new Error(
      "withConnection (session-scoped connection) is not supported for Neon driver; use a staging table or run with local DB for temp-table support."
    );
  }
  const pool = (db as unknown as { $client: Pool }).$client;
  const client = await pool.connect();
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

//export type Database = typeof db;
export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
