import { z, ZodType } from "zod";
import { AssetTransaction, RecurringContribution } from "./portfolio-assets";
import type { SchedulePattern } from "@shared/utils/scheduling";

export type RecurringContributionFormData = Pick<
  RecurringContribution,
  "amount" | "startDate" | "isActive" | "pattern"
>;

export const patternSchema = z.object({
  type: z.enum(["cron", "rrule"]),
  expression: z.string(),
});

export type SchedulePatternInsert = z.infer<typeof patternSchema>;

export const recurringContributionOrphanSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
  pattern: patternSchema.required(),
  // interval: z.enum(["weekly", "biweekly", "monthly"], {
  //   required_error: "Interval is required",
  // }),
  isActive: z.boolean().default(true),
});

export type RecurringContributionOrphanInsert = z.infer<
  typeof recurringContributionOrphanSchema
>;

export type SingleContributionFormData = Pick<AssetTransaction, "value" | "valueDate">;

export const singleContributionOrphanSchema = z.object({
  value: z.coerce.number(),
  valueDate: z.coerce.date(),
});

export const isSingleContributionFormData = (
  data: SingleContributionFormData | RecurringContributionFormData
): data is SingleContributionFormData => {
  return "value" in data;
};

export const isRecurringContributionFormData = (
  data: SingleContributionFormData | RecurringContributionFormData
): data is RecurringContributionFormData => {
  return "amount" in data && "startDate" in data && "interval" in data;
};

export const isAssetContribution = (
  data: AssetTransaction | RecurringContribution
): data is AssetTransaction => {
  return "value" in data && "recordedAt" in data;
};

export const isRecurringContribution = (
  data: AssetTransaction | RecurringContribution
): data is RecurringContribution => {
  return "amount" in data && "startDate" in data && "interval" in data;
};
