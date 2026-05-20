import { z, ZodType } from "zod";
import { InsertMilestone as DBInsertMilestone, SelectMilestone as DBMilestone } from "@server/db/schema/portfolio-milestone";
import { decimalValueSchema } from "@server/db/schema/utils";
import { currencyGreaterThanZeroSchema } from "./decimal-value";

export const milestoneOrphanInsertSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetValue: currencyGreaterThanZeroSchema,
  accountType: z.string().optional().nullable(),
});

milestoneOrphanInsertSchema._output satisfies Omit<
  DBInsertMilestone,
  "userAccountId"
>;

export type MilestoneOrphanInsert = z.infer<typeof milestoneOrphanInsertSchema>;

export const milestoneInsertSchema = milestoneOrphanInsertSchema.extend({
  userAccountId: z.string(),
});

milestoneInsertSchema._output satisfies DBInsertMilestone;

export type MilestoneInsert = z.infer<typeof milestoneInsertSchema>;

export type Milestone = DBMilestone;

export const milestoneSchema = z.object({
  id: z.string(),
  userAccountId: z.string(),
  name: z.string(),
  targetValue: currencyGreaterThanZeroSchema,
  accountType: z.string().nullable(),
  isCompleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

milestoneSchema._output satisfies Milestone;

