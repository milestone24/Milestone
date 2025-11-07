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
  decimalValueSchema,
} from "@server/db/schema/index";

export {
  maritalStatus,
  gender,
  employmentStatus,
} from "@server/db/schema/index";

import {
  dateTransformedSchema,
  DecimalValueString,
  IfConstructorEquals,
  isDecimalValueString,
} from "./utils";

// Core schemas
export const coreUserInsertSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
}) satisfies ZodType<DBInsertCoreUser>;

export type InsertCoreUser = z.infer<typeof coreUserInsertSchema>;

export type CoreUser = DBCoreUser;

export const userAccountInsertSchema = z.object({
  coreUserId: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable().optional(),
  passwordHash: z.string(),
  fullName: z.string(),
  isEmailVerified: z.boolean().optional(),
  isPhoneVerified: z.boolean().optional(),
}) satisfies ZodType<Omit<DBInsertUserAccount, "id">>;

export type UserAccountInsert = z.infer<typeof userAccountInsertSchema>;

export const userAccountSchema = userAccountInsertSchema.extend({
  id: z.string(),
  createdAt: dateTransformedSchema.nullable().transform((val) => val ?? null),
  updatedAt: dateTransformedSchema.nullable().transform((val) => val ?? null),
}); // satisfies ZodType<Omit<DBUserAccount, "createdAt" | "updatedAt">>;

//export type UserAccount = DBUserAccount;
export type UserAccount = z.infer<typeof userAccountSchema>;

export const updateProfileOrphanSchema = z.object({
  //avatarUrl: z.string().nullable().optional(),
  //.transform((val) => val ?? null),
  dob: dateTransformedSchema.nullable().transform((val) => val ?? null),
  avatarUrl: z
    .string()
    .nullable()
    .transform((val) => val ?? null),
  countryOrigin: z
    .string()
    .nullable()
    .transform((val) => val ?? null),
  countryResidence: z
    .string()
    .nullable()
    .transform((val) => val ?? null),
  gender: z
    .enum(gender)
    .nullable()
    .transform((val) => val ?? null),
  maritalStatus: z
    .enum(maritalStatus)
    .nullable()
    .transform((val) => val ?? null),
  employmentStatus: z
    .enum(employmentStatus)
    .nullable()
    .transform((val) => val ?? null),
  incomeLevel: z
    .enum(["low", "medium", "high", "other"])
    .nullable()
    .transform((val) => val ?? null),
  netWorth: decimalValueSchema.nullable().transform((val) => val ?? null),
});

updateProfileOrphanSchema._output satisfies Omit<
  DBInsertUserProfile,
  "userAccountId"
>;

export type UpdateProfileOrphanInput = z.infer<
  typeof updateProfileOrphanSchema
>;

export const userProfileInsertSchema = updateProfileOrphanSchema.extend({
  userAccountId: z.string(),
});

userProfileInsertSchema._output satisfies DBInsertUserProfile;

export type UserProfileInsert = z.infer<typeof userProfileInsertSchema>;

export const userProfileSchema = userProfileInsertSchema.extend({
  id: z.string(),
});

userProfileSchema._output satisfies Omit<
  DBUserProfile,
  "createdAt" | "updatedAt"
>;

//export type UserProfile = DBUserProfile;
export type UserProfile = z.infer<typeof userProfileSchema>;

export const passwordResetInsertSchema = z.object({
  userAccountId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
}) satisfies ZodType<DBInsertPasswordReset>;

export type PasswordResetInsert = z.infer<typeof passwordResetInsertSchema>;
export type PasswordReset = DBPasswordReset;

export const passwordChangeHistoryInsertSchema = z.object({
  userAccountId: z.string(),
  passwordHash: z.string(),
  changedAt: z.date(),
}) satisfies ZodType<DBInsertPasswordChangeHistory>;

export type PasswordChangeHistoryInsert = z.infer<
  typeof passwordChangeHistoryInsertSchema
>;

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

export const userSessionSchema = z.object({
  id: z.string(),
  account: userAccountSchema,
  profile: userProfileSchema,
});

export type SessionUser = z.infer<typeof userSessionSchema>;

export const sessionResponseSchema = z.object({
  user: userSessionSchema,
  message: z.string(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;
