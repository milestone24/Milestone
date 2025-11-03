import { z, ZodType } from "zod";
import { InsertFireSettings as DBInsertFireSettings, SelectFireSettings as DBSelectFireSettings } from "@server/db/schema/portfolio-fire";
import { IfConstructorEquals, isDecimalValueString, Orphan } from "./utils";
import { decimalValueSchema } from "@server/db/schema/utils";

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

export const fireSettingsOrphanSchema = z.object({
  targetRetirementAge: z.coerce.number().int(),
  annualIncomeGoal: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual income goal must be a valid decimal string",
  }),
  expectedAnnualReturn: decimalValueSchema.refine(isDecimalValueString, {
    message: "Expected annual return must be a valid decimal string",
  }),
  safeWithdrawalRate: decimalValueSchema.refine(isDecimalValueString, {
    message: "Safe withdrawal rate must be a valid decimal string",
  }),
  monthlyInvestment: decimalValueSchema.refine(isDecimalValueString, {
    message: "Monthly investment must be a valid decimal string",
  }),
  //currentAge: z.coerce.number().int(), //Removed because age is calculated from dob
  //adjustInflation: z.boolean().default(DEFAULT_ADJUST_INFLATION),
  adjustInflation: z.boolean().optional().default(DEFAULT_ADJUST_INFLATION),
  statePensionAge: z.number().int().default(DEFAULT_STATE_PENSION_AGE),
  //statePensionAge: z.coerce.number().int().optional(),
});

fireSettingsOrphanSchema._output satisfies Omit<
  DBInsertFireSettings,
  "userAccountId"
>;

export type FireSettingsOrphan = z.infer<typeof fireSettingsOrphanSchema>;

export const fireSettingsInsertSchema = fireSettingsOrphanSchema.extend({
  userAccountId: z.string(),
});

fireSettingsInsertSchema._output satisfies DBInsertFireSettings;

export type FireSettingsInsert = z.infer<typeof fireSettingsInsertSchema>;

export type FireSettings = DBSelectFireSettings;



