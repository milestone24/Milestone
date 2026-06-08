import { createDatabaseConnection } from "@milestone/data";
import { log, error, warn, info, debug } from "../log";

const connection = createDatabaseConnection({ log, error, warn, info, debug });

export const { db, ping, withConnection } = connection;

export type { Database, Schema } from "@milestone/data";
