import { z } from "zod";
import { AssetContribution, RecurringContribution } from "./portfolio-assets";

export type RecurringContributionFormData = Pick<
  RecurringContribution,
  "amount" | "startDate" | "interval" | "isActive"
>;

export const recurringContributionOrphanSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
  interval: z.enum(["weekly", "biweekly", "monthly"], {
    required_error: "Interval is required",
  }),
  isActive: z.boolean().default(true),
});

export type SingleContributionFormData = Pick<
  AssetContribution,
  "value" | "valueDate"
>;

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
  data: AssetContribution | RecurringContribution
): data is AssetContribution => {
  return "value" in data && "recordedAt" in data;
};

export const isRecurringContribution = (
  data: AssetContribution | RecurringContribution
): data is RecurringContribution => {
  return "amount" in data && "startDate" in data && "interval" in data;
};
