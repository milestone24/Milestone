import { randomBytes } from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { timeToExpiryDate } from "../utils/time";
import {
  emailVerifications,
  phoneVerifications,
  userAccounts,
} from "@/db/schema";

export async function generateEmailVerification(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = timeToExpiryDate("24h"); // Email verification tokens expire in 24 hours

  await db.insert(emailVerifications).values({
    userAccountId: userId,
    token,
    expiresAt,
  });

  return token;
}

export async function generatePhoneVerification(userId: string): Promise<string> {
  const token = randomBytes(6).toString("hex").toUpperCase(); // 6-digit code
  const expiresAt = timeToExpiryDate("10m"); // Phone verification tokens expire in 10 minutes

  await db.insert(phoneVerifications).values({
    userAccountId: userId,
    token,
    expiresAt,
  });

  return token;
}

export async function verifyEmailToken(userId: string, token: string): Promise<boolean> {
  const verification = await db.query.emailVerifications.findFirst({
    where: eq(emailVerifications.userAccountId, userId),
    orderBy: (emailVerifications, { desc }) => [desc(emailVerifications.createdAt)],
  });

  if (!verification) {
    return false;
  }

  if (verification.isCompleted || new Date(verification.expiresAt) < new Date()) {
    return false;
  }

  if (verification.token !== token) {
    return false;
  }

  // Mark verification as completed
  await db
    .update(emailVerifications)
    .set({
      isCompleted: true,
      completedAt: new Date(),
    })
    .where(eq(emailVerifications.id, verification.id));

  // Update user account
  await db
    .update(userAccounts)
    .set({ isEmailVerified: true })
    .where(eq(userAccounts.id, userId));

  return true;
}

export async function verifyPhoneToken(userId: string, token: string): Promise<boolean> {
  const verification = await db.query.phoneVerifications.findFirst({
    where: eq(phoneVerifications.userAccountId, userId),
    orderBy: (phoneVerifications, { desc }) => [desc(phoneVerifications.createdAt)],
  });

  if (!verification) {
    return false;
  }

  if (verification.isCompleted || new Date(verification.expiresAt) < new Date()) {
    return false;
  }

  if (verification.token !== token) {
    return false;
  }

  // Mark verification as completed
  await db
    .update(phoneVerifications)
    .set({
      isCompleted: true,
      completedAt: new Date(),
    })
    .where(eq(phoneVerifications.id, verification.id));

  // Update user account
  await db
    .update(userAccounts)
    .set({ isPhoneVerified: true })
    .where(eq(userAccounts.id, userId));

  return true;
}

export async function resendEmailVerification(userId: string): Promise<string> {
  // Revoke any existing uncompleted verifications
  await db
    .update(emailVerifications)
    .set({ isCompleted: true })
    .where(eq(emailVerifications.userAccountId, userId));

  // Generate new verification
  return generateEmailVerification(userId);
}

export async function resendPhoneVerification(userId: string): Promise<string> {
  // Revoke any existing uncompleted verifications
  await db
    .update(phoneVerifications)
    .set({ isCompleted: true })
    .where(eq(phoneVerifications.userAccountId, userId));

  // Generate new verification
  return generatePhoneVerification(userId);
} 
