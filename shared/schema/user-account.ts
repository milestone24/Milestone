import { coerce, z, ZodType } from "zod";
import type {
  SelectCoreUser as DBCoreUser,
  SelectUserAccount as DBUserAccount,
  SelectUserProfile as DBUserProfile,
  SelectPasswordReset as DBPasswordReset,
  SelectPasswordChangeHistory as DBPasswordChangeHistory,
  SelectUserSubscription as DBUserSubscription,
  SelectRefreshToken as DBRefreshToken,
  SelectEmailVerification as DBEmailVerification,
  SelectPhoneVerification as DBPhoneVerification,
  InsertCoreUser as DBInsertCoreUser,
  InsertUserAccount as DBInsertUserAccount,
  InsertUserProfile as DBInsertUserProfile,
  InsertPasswordReset as DBInsertPasswordReset,
  InsertPasswordChangeHistory as DBInsertPasswordChangeHistory,
  InsertUserSubscription as DBInsertUserSubscription,
  InsertRefreshToken as DBInsertRefreshToken,
  InsertEmailVerification as DBInsertEmailVerification,
  InsertPhoneVerification as DBInsertPhoneVerification,
  InsertUserAccount,
} from "@server/db/schema/user-account";

import {
  maritalStatus,
  gender,
  employmentStatus,
} from "@server/db/schema/index";

export {
  maritalStatus,
  gender,
  employmentStatus,
} from "@server/db/schema/index";

import { IfConstructorEquals } from "./utils";

// Core schemas
export const coreUserInsertSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

type ZodCoreUser = z.infer<typeof coreUserInsertSchema>;
export type InsertCoreUser = IfConstructorEquals<
  ZodCoreUser,
  DBInsertCoreUser,
  never
>;
coreUserInsertSchema satisfies ZodType<InsertCoreUser>;
export type CoreUser = DBCoreUser;

export const userAccountInsertSchema = z.object({
  coreUserId: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable().optional(),
  passwordHash: z.string(),
  fullName: z.string(),
  isEmailVerified: z.boolean().optional(),
  isPhoneVerified: z.boolean().optional(),
});

type ZodUserAccount = z.infer<typeof userAccountInsertSchema>;
export type UserAccountInsert = IfConstructorEquals<
  ZodUserAccount,
  DBInsertUserAccount,
  never
>;
userAccountInsertSchema satisfies ZodType<InsertUserAccount>;
export type UserAccount = DBUserAccount;

export const userProfileInsertSchema = z.object({
  userAccountId: z.string(),
  avatarUrl: z.string().nullable().optional(),
});

type ZodUserProfile = z.infer<typeof userProfileInsertSchema>;
export type UserProfileInsert = IfConstructorEquals<
  ZodUserProfile,
  DBInsertUserProfile,
  never
>;
userProfileInsertSchema satisfies ZodType<UserProfileInsert>;
export type UserProfile = DBUserProfile;
export const passwordResetInsertSchema = z.object({
  userAccountId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
});

type ZodPasswordReset = z.infer<typeof passwordResetInsertSchema>;
export type PasswordResetInsert = IfConstructorEquals<
  ZodPasswordReset,
  DBInsertPasswordReset,
  never
>;
passwordResetInsertSchema satisfies ZodType<PasswordResetInsert>;
export type PasswordReset = DBPasswordReset;

export const passwordChangeHistoryInsertSchema = z.object({
  userAccountId: z.string(),
  passwordHash: z.string(),
  changedAt: z.date(),
});

type ZodPasswordChangeHistory = z.infer<
  typeof passwordChangeHistoryInsertSchema
>;
export type PasswordChangeHistoryInsert = IfConstructorEquals<
  ZodPasswordChangeHistory,
  DBInsertPasswordChangeHistory,
  never
>;
passwordChangeHistoryInsertSchema satisfies ZodType<PasswordChangeHistoryInsert>;
export type PasswordChangeHistory = DBPasswordChangeHistory;

export const userSubscriptionInsertSchema = z.object({
  userAccountId: z.string(),
  plan: z.string(),
  status: z.enum(["active", "cancelled", "expired"]),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
});

type ZodUserSubscription = z.infer<typeof userSubscriptionInsertSchema>;
export type UserSubscriptionInsert = IfConstructorEquals<
  ZodUserSubscription,
  DBInsertUserSubscription,
  never
>;
userSubscriptionInsertSchema satisfies ZodType<UserSubscriptionInsert>;
export type UserSubscription = DBUserSubscription;
export const refreshTokenInsertSchema = z.object({
  tenantId: z.string(),
  userAccountId: z.string(),
  tokenHash: z.string(),
  familyId: z.string(),
  parentTokenHash: z.string().nullable().optional(),
  deviceInfo: z.string().nullable().optional(),
  lastUsedAt: z.date(),
  expiresAt: z.date(),
});

type ZodRefreshToken = z.infer<typeof refreshTokenInsertSchema>;
export type RefreshTokenInsert = IfConstructorEquals<
  ZodRefreshToken,
  DBInsertRefreshToken,
  never
>;
refreshTokenInsertSchema satisfies ZodType<RefreshTokenInsert>;
export type RefreshToken = DBRefreshToken;
export const emailVerificationInsertSchema = z.object({
  userAccountId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
});

type ZodEmailVerification = z.infer<typeof emailVerificationInsertSchema>;
export type EmailVerificationInsert = IfConstructorEquals<
  ZodEmailVerification,
  DBInsertEmailVerification,
  never
>;
emailVerificationInsertSchema satisfies ZodType<EmailVerificationInsert>;
export type EmailVerification = DBEmailVerification;

export const phoneVerificationInsertSchema = z.object({
  userAccountId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
});

type ZodPhoneVerification = z.infer<typeof phoneVerificationInsertSchema>;
export type PhoneVerificationInsert = IfConstructorEquals<
  ZodPhoneVerification,
  DBInsertPhoneVerification,
  never
>;
phoneVerificationInsertSchema satisfies ZodType<PhoneVerificationInsert>;
export type PhoneVerification = DBPhoneVerification;
// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().email(),
    fullName: z.string(),
    phoneNumber: z.string().optional(),
    password: z.string().min(8),
  })
  .transform((data) => ({
    ...data,
    phoneNumber: data.phoneNumber === "" ? null : data.phoneNumber,
  }));

export type RegisterInput = z.infer<typeof registerSchema>;

export const revokeFamilySchema = z.object({
  familyId: z.string(),
});

export type ZodRevokeFamily = z.infer<typeof revokeFamilySchema>;

export const updateProfileOrphanSchema = z.object({
  //avatarUrl: z.string().nullable().optional(),
  //.transform((val) => val ?? null),
  dob: z.coerce.date().nullable().optional(),
  countryOrigin: z.string().nullable().optional(),
  countryResidence: z.string().nullable().optional(),
  gender: z.enum(gender).nullable().optional(),
  maritalStatus: z.enum(maritalStatus).nullable().optional(),
  employmentStatus: z.enum(employmentStatus).nullable().optional(),
  incomeLevel: z.enum(["low", "medium", "high", "other"]).nullable().optional(),
  netWorth: z.number().nullable().optional(),
});

export type ZodUpdateProfileOrphanInput = z.infer<
  typeof updateProfileOrphanSchema
>;

//type A<T> = T;

type B<C, T extends C = C> = T extends C ? T : never;

type D = B<
  Omit<DBInsertUserProfile, "userAccountId">,
  ZodUpdateProfileOrphanInput
>;

export type UpdateProfileOrphanInput = IfConstructorEquals<
  ZodUpdateProfileOrphanInput,
  Omit<DBInsertUserProfile, "userAccountId">,
  never
>;

updateProfileOrphanSchema satisfies ZodType<UpdateProfileOrphanInput>;

export type SessionUser = {
  id: string;
  account: DBUserAccount;
  profile: DBUserProfile;
};
