import { z, ZodType } from "zod";
import { InsertFireSettings as DBInsertFireSettings, SelectFireSettings as DBSelectFireSettings } from "@server/db/schema/portfolio-fire";
import { IfConstructorEquals, isDecimalValueString, Orphan } from "./utils";
import { decimalValueSchema } from "@server/db/schema/utils";
import {
  type IncomeGoalKey as DBIncomeGoalKey,
  type IncomeGoal as DBIncomeGoal,
  IncomeGoalKeys as DBIncomeGoalKeys,
} from "@server/db/schema/portfolio-fire";

export const DEFAULT_TARGET_RETIREMENT_AGE = 60;
export const DEFAULT_ANNUAL_INCOME_GOAL = 48000;
export const DEFAULT_EXPECTED_ANNUAL_RETURN = 7;
export const DEFAULT_SAFE_WITHDRAWAL_RATE = 4;
export const DEFAULT_MONTHLY_INVESTMENT = 300;
export const DEFAULT_CURRENT_AGE = 35;
export const DEFAULT_ADJUST_INFLATION = true;
export const DEFAULT_STATE_PENSION_AGE = 66; // UK State Pension age (66 or 67)

export const defaultValues = {
  targetRetirementAge: DEFAULT_TARGET_RETIREMENT_AGE,
  annualIncomeGoal: DEFAULT_ANNUAL_INCOME_GOAL,
  expectedAnnualReturn: DEFAULT_EXPECTED_ANNUAL_RETURN,
  safeWithdrawalRate: DEFAULT_SAFE_WITHDRAWAL_RATE,
  monthlyInvestment: DEFAULT_MONTHLY_INVESTMENT,
  currentAge: DEFAULT_CURRENT_AGE,
  adjustInflation: DEFAULT_ADJUST_INFLATION,
  statePensionAge: DEFAULT_STATE_PENSION_AGE,
};

export type IncomeGoalKey = DBIncomeGoalKey;

export const incomeGoalSchema = z.object({
  //We provide a key so that we can add income goals by other means.
  //ie fireSettings "reduced_spending_at_75"
  key: z.enum(DBIncomeGoalKeys).optional(),
  fromAge: z.number().int(),
  incomeGoal: decimalValueSchema.refine(isDecimalValueString, {
    message: "Income goal must be a valid decimal string",
  }),
});

incomeGoalSchema._output satisfies DBIncomeGoal;

export type IncomeGoal = z.infer<typeof incomeGoalSchema>;

export const fireSettingsOrphanSchema = z.object({
  targetRetirementAge: z.coerce.number().int(),
  annualIncomeGoal: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual income goal is required",
  }),
  //Temporarily satisfy the type whilst we remove expectedAnnualReturn from the settings.
  // expectedAnnualReturn: decimalValueSchema.refine(isDecimalValueString, {
  //   message: "Expected annual return must be a valid decimal string",
  // }),
  safeWithdrawalRate: decimalValueSchema.refine(isDecimalValueString, {
    message: "Safe withdrawal rate is required",
  }),
  //Temporarily satisfy the type whilst we remove monthlyInvestment from the settings.
  // monthlyInvestment: decimalValueSchema.refine(isDecimalValueString, {
  //   message: "Monthly investment must be a valid decimal string",
  // }),
  adjustInflation: z.boolean().optional().default(DEFAULT_ADJUST_INFLATION),
  includeStatePension: z.boolean().optional().default(false),
  incomeGoals: incomeGoalSchema.array(),
});

fireSettingsOrphanSchema._output satisfies Omit<
  DBInsertFireSettings,
  "userAccountId" | "monthlyInvestment" | "expectedAnnualReturn"
>;

fireSettingsOrphanSchema._output satisfies Omit<
  DBSelectFireSettings,
  "userAccountId" | "id" | "createdAt" | "updatedAt" | "monthlyInvestment" | "expectedAnnualReturn"
>;

export const fireSettingsOrphanFormSchema = fireSettingsOrphanSchema
  .omit({ incomeGoals: true })
  .extend({
    reduceSpendingAt75: z.boolean(),
  });

export type FireSettingsOrphan = z.infer<typeof fireSettingsOrphanSchema>;

export const fireSettingsInsertSchema = fireSettingsOrphanSchema.extend({
  userAccountId: z.string(),
});

fireSettingsInsertSchema._output satisfies Omit<DBInsertFireSettings, "monthlyInvestment" | "expectedAnnualReturn">;

export type FireSettingsInsert = z.infer<typeof fireSettingsInsertSchema>;

export type FireSettings = DBSelectFireSettings;



