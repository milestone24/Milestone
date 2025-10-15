import { pgTable, integer, decimal, uuid, boolean } from "drizzle-orm/pg-core";
import { userAccounts } from "./user-account";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { InferSelectModel, sql } from "drizzle-orm";

export const fireSettings = pgTable("fire_settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  targetRetirementAge: integer("target_retirement_age").notNull(),
  annualIncomeGoal: decimal("annual_income_goal", {
    precision: 15,
    scale: 2,
  }).notNull(), // Supports up to 9.99 trillion with 2 decimals (handles IDR, VND, etc.)
  expectedAnnualReturn: decimal("expected_annual_return", {
    precision: 8,
    scale: 2,
  }).notNull(), // Percentage: 0.00 to 999,999.99 (allows for extreme returns and edge cases)
  safeWithdrawalRate: decimal("safe_withdrawal_rate", {
    precision: 4,
    scale: 2,
  }).notNull(), // Percentage: 0.00 to 99.99
  monthlyInvestment: decimal("monthly_investment", {
    precision: 15,
    scale: 2,
  }).notNull(), // Supports up to 9.99 trillion with 2 decimals
  adjustInflation: boolean("adjust_inflation").default(true).notNull(),
  statePensionAge: integer("state_pension_age").default(66).notNull(), // UK State Pension age (66 or 67)
  ...timestampColumns(),
});

export type InsertFireSettings = InferInsertModelBasic<typeof fireSettings>;
export type SelectFireSettings = InferSelectModel<typeof fireSettings>;
