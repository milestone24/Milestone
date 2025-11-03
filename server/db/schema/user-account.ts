import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  date,
  decimal,
} from "drizzle-orm/pg-core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { z } from "zod";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { userAssets } from "./portfolio-assets";

// Core User table
export const coreUsers = pgTable("core_users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  status: text("status", { enum: ["active", "inactive", "suspended"] })
    .notNull()
    .default("active"),
  ...timestampColumns(),
});

export type SelectCoreUser = InferSelectModel<typeof coreUsers>;
export type InsertCoreUser = InferInsertModelBasic<typeof coreUsers>;

export const coreUsersRelations = relations(coreUsers, ({ one, many }) => ({
  userAccounts: many(userAccounts),
}));

// User Account table
export const userAccounts = pgTable("user_accounts", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  coreUserId: uuid("core_user_id")
    .notNull()
    .references(() => coreUsers.id),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number").unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
  ...timestampColumns(),
});

export type SelectUserAccount = InferSelectModel<typeof userAccounts>;
export type InsertUserAccount = InferInsertModelBasic<typeof userAccounts>;

export const userAccountAssets = pgTable("user_account_assets", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  userAssetId: uuid("user_asset_id")
    .notNull()
    .references(() => userAssets.id),
  ...timestampColumns(),
});

export type SelectUserAccountAsset = InferSelectModel<typeof userAccountAssets>;
export type InsertUserAccountAsset = InferInsertModelBasic<
  typeof userAccountAssets
>;

// Email Verification table
export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  token: text("token").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestampColumns(),
});

export type SelectEmailVerification = InferSelectModel<
  typeof emailVerifications
>;
export type InsertEmailVerification = InferInsertModelBasic<
  typeof emailVerifications
>;

// Phone Verification table
export const phoneVerifications = pgTable("phone_verifications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  token: text("token").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestampColumns(),
});

export type SelectPhoneVerification = InferSelectModel<
  typeof phoneVerifications
>;
export type InsertPhoneVerification = InferInsertModelBasic<
  typeof phoneVerifications
>;

export const userAccountsRelations = relations(
  userAccounts,
  ({ one, many }) => ({
    coreUser: one(coreUsers, {
      fields: [userAccounts.coreUserId],
      references: [coreUsers.id],
    }),
    userProfile: one(userProfiles, {
      fields: [userAccounts.id],
      references: [userProfiles.userAccountId],
    }),
    passwordResets: many(passwordResets),
    passwordChangeHistory: many(passwordChangeHistory),
    refreshTokens: many(refreshTokens),
    emailVerifications: many(emailVerifications),
    phoneVerifications: many(phoneVerifications),
    userSubscriptions: many(userSubscriptions),
  })
);

export const maritalStatus = [
  "single",
  "married",
  "divorced",
  "widowed",
] as const;
export const employmentStatus = [
  "employed",
  "self-employed",
  "unemployed",
  "retired",
  "student",
  "other",
] as const;
export const incomeLevel = ["low", "medium", "high", "other"] as const;
export const gender = ["male", "female", "other"] as const;

export const maritalStatusEnum = pgEnum("marital_status", maritalStatus);
export const employmentStatusEnum = pgEnum(
  "employment_status",
  employmentStatus
);
export const incomeLevelEnum = pgEnum("income_level", incomeLevel);
export const genderEnum = pgEnum("gender", gender);

// User Profile table
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  avatarUrl: text("avatar_url"),
  dob: date("dob", { mode: "date" }),
  countryOrigin: text("country_origin"),
  countryResidence: text("country_residence"),
  gender: genderEnum("gender"),
  maritalStatus: maritalStatusEnum("marital_status"),
  employmentStatus: employmentStatusEnum("employment_status"),
  incomeLevel: incomeLevelEnum("income_level"),
  netWorth: decimal("net_worth", { precision: 18, scale: 2 }),
  // Add profile fields as needed
  ...timestampColumns(),
});

export type SelectUserProfile = InferSelectModel<typeof userProfiles>;
export type InsertUserProfile = InferInsertModelBasic<typeof userProfiles>;

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  userAccount: one(userAccounts, {
    fields: [userProfiles.userAccountId],
    references: [userAccounts.id],
  }),
}));

// Password Reset table
export const passwordResets = pgTable("password_resets", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  token: text("token").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestampColumns(),
});

export type SelectPasswordReset = InferSelectModel<typeof passwordResets>;
export type InsertPasswordReset = InferInsertModelBasic<typeof passwordResets>;

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  userAccount: one(userAccounts, {
    fields: [passwordResets.userAccountId],
    references: [userAccounts.id],
  }),
}));

// Password Change History table
export const passwordChangeHistory = pgTable("password_change_history", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  passwordHash: text("password_hash").notNull(),
  changedAt: timestamp("changed_at").notNull(),
  ...timestampColumns(),
});

export type SelectPasswordChangeHistory = InferSelectModel<
  typeof passwordChangeHistory
>;
export type InsertPasswordChangeHistory = InferInsertModelBasic<
  typeof passwordChangeHistory
>;

export const passwordChangeHistoryRelations = relations(
  passwordChangeHistory,
  ({ one }) => ({
    userAccount: one(userAccounts, {
      fields: [passwordChangeHistory.userAccountId],
      references: [userAccounts.id],
    }),
  })
);

// User Subscription table
export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  plan: text("plan").notNull(),
  status: text("status", {
    enum: ["active", "cancelled", "expired"],
  }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  ...timestampColumns(),
});

export type SelectUserSubscription = InferSelectModel<typeof userSubscriptions>;
export type InsertUserSubscription = InferInsertModelBasic<
  typeof userSubscriptions
>;

export const userSubscriptionsRelations = relations(
  userSubscriptions,
  ({ one }) => ({
    userAccount: one(userAccounts, {
      fields: [userSubscriptions.userAccountId],
      references: [userAccounts.id],
    }),
  })
);

// Refresh Token table
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => coreUsers.id),
  userAccountId: uuid("user_account_id")
    .notNull()
    .references(() => userAccounts.id),
  tokenHash: text("token_hash").notNull(),
  familyId: text("family_id").notNull(),
  parentTokenHash: text("parent_token_hash"),
  deviceInfo: text("device_info"),
  lastUsedAt: timestamp("last_used_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  ...timestampColumns(),
});

export type SelectRefreshToken = InferSelectModel<typeof refreshTokens>;
export type InsertRefreshToken = InferInsertModelBasic<typeof refreshTokens>;

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  userAccount: one(userAccounts, {
    fields: [refreshTokens.userAccountId],
    references: [userAccounts.id],
  }),
}));

export const revokeFamilySchema = z.object({
  familyId: z.string(),
});
