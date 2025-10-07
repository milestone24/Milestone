import {
  pgTable,
  uuid,
  timestamp,
  text,
  pgEnum,
  jsonb,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { InferSelectModel } from "drizzle-orm";

export const processStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export const processStatus = pgEnum("process_status", processStatuses);
export type ProcessStatus = (typeof processStatuses)[number];

export type ProcessData = {};

export type ProcessResults = {};

export type ProcessReferences = {
  type: "table";
}[];

export const processes = pgTable("processes", {
  id: uuid("id").primaryKey(),
  key: text("key").notNull(),
  status: processStatus("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  supersededBy: uuid("superseded_by").references(
    (): AnyPgColumn => processes.id,
    {
      onDelete: "set null",
    }
  ),
  payload: jsonb("payload").$type<ProcessData>().notNull(),
  results: jsonb("results").$type<ProcessResults>().notNull(),
  references: jsonb("references").$type<ProcessReferences>().notNull(),
  error: text("error").notNull(),
  result: text("result").notNull(),
  type: text("type").notNull(),
  ...timestampColumns(),
});

export type ProcessSelect = InferSelectModel<typeof processes>;
export type ProcessInsert = InferInsertModelBasic<typeof processes>;
