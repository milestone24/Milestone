import {
  pgTable,
  integer,
  decimal,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { userAccounts } from "./user-account.js";
import {
  brandedDecimal,
  DecimalValueString,
  InferInsertModelBasic,
  timestampColumns,
} from "./utils.js";
import { InferSelectModel, sql } from "drizzle-orm";

export const IncomeGoalKeys = ["retirement_start", "reduced_spending_at_75", "other"] as const;

export type IncomeGoalKey = (typeof IncomeGoalKeys)[number];

export type IncomeGoal = {
  key?: IncomeGoalKey;
  fromAge: number;
  incomeGoal: DecimalValueString;
};


export const fireSettings = pgTable("fire_settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  targetRetirementAge: integer("target_retirement_age").notNull(),
  annualIncomeGoal: brandedDecimal("annual_income_goal").notNull(), // Supports up to 9.99 trillion with 2 decimals (handles IDR, VND, etc.)
  expectedAnnualReturn: brandedDecimal("expected_annual_return").notNull(), // Percentage: 0.00 to 999,999.99 (allows for extreme returns and edge cases)
  safeWithdrawalRate: brandedDecimal("safe_withdrawal_rate").notNull(), // Percentage: 0.00 to 99.99
  monthlyInvestment: brandedDecimal("monthly_investment").notNull(), // Supports up to 9.99 trillion with 2 decimals
  adjustInflation: boolean("adjust_inflation").default(true).notNull(),
  includeStatePension: boolean("include_state_pension")
    .default(false)
    .notNull(),
  incomeGoals: jsonb("income_goals")
    .$type<IncomeGoal[]>()
    .notNull()
    .default([]),
  ...timestampColumns(),
});

export type InsertFireSettings = InferInsertModelBasic<typeof fireSettings>;
export type SelectFireSettings = InferSelectModel<typeof fireSettings>;
