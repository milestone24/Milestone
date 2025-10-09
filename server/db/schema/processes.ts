import {
  pgTable,
  uuid,
  timestamp,
  text,
  pgEnum,
  jsonb,
  AnyPgColumn,
  check,
} from "drizzle-orm/pg-core";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { InferSelectModel, sql } from "drizzle-orm";

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

export const processes = pgTable(
  "processes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: text("key").notNull(),
    status: processStatus("status").notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    supersededBy: uuid("superseded_by").references(
      (): AnyPgColumn => processes.id,
      {
        onDelete: "set null",
      }
    ),
    payload: jsonb("payload").$type<ProcessData>().notNull(),
    results: jsonb("results").$type<ProcessResults>(),
    references: jsonb("references").$type<ProcessReferences>(),
    error: text("error"),

    ...timestampColumns(),
  },
  (table) => [
    //TODO add constraint to check that status is completed or failed if completedAt is not null
    check(
      "status_completed_or_failed_has_completed_at",
      sql`(${table.status} in ('completed', 'failed') and ${table.completedAt} is not null) or (${table.status} not in ('completed', 'failed') and ${table.completedAt} is null)`
    ),
  ]
);

export type ProcessSelect = InferSelectModel<typeof processes>;
export type ProcessInsert = InferInsertModelBasic<typeof processes>;
