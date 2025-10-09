import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "server/db/schema/index";
import { sql } from "drizzle-orm";
import { log, error, warn, info, debug } from "../log";
export { Client as PgClient } from "pg";

import { DefaultLogger, LogWriter } from 'drizzle-orm/logger';
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
    isLocalDb
  };
}

// Create a singleton instance
const { db, isLocalDb } = createDatabaseConnection();

const ping = async () => {
  console.log("Pinging database...");
  const pingResult = await db.execute(sql`SELECT 1`);
  console.log("Database ping successful:");
}

export { db, isLocalDb, ping }; 

export type Database = typeof db;
