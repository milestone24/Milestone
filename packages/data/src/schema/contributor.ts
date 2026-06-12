import { pgEnum } from "drizzle-orm/pg-core";

export const accountType = [
  "ISA",
  "SIPP",
  "LISA",
  "GIA",
  "OTHER", // Would represent something with zero bonuses, no tax, etc.
] as const;

export const accountTypeEnum = pgEnum("account_type", accountType);

export type AccountType = (typeof accountType)[number];
