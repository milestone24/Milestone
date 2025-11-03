import { z, ZodType } from "zod";
import { InsertMilestone as DBInsertMilestone, SelectMilestone as DBMilestone } from "@server/db/schema/portfolio-milestone";
import { IfConstructorEquals, isDecimalValueString, Orphan } from "./utils";
import { decimalValueSchema } from "@server/db/schema/utils";

export const milestoneOrphanInsertSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
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

