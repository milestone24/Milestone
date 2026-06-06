import { pgTable, text, boolean, uuid, decimal } from "drizzle-orm/pg-core";
import { userAccounts } from "./user-account.js";
import {
  brandedDecimal,
  InferInsertModelBasic,
  timestampColumns,
} from "./utils.js";
import { InferSelectModel, sql } from "drizzle-orm";
// Milestones table to track investment goals
export const milestones = pgTable("milestones", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  name: text("name").notNull(),
  targetValue: brandedDecimal("target_value").notNull(),
  accountType: text("account_type"), // Optional, can be specific to an account type (ISA, SIPP, LISA, GIA) or null for total portfolio
  isCompleted: boolean("is_completed").default(false).notNull(),
  ...timestampColumns(),
});

export type InsertMilestone = Omit<
  InferInsertModelBasic<typeof milestones>,
  "isCompleted"
>;
export type SelectMilestone = InferSelectModel<typeof milestones>;
