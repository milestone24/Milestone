import { eq, and } from "drizzle-orm";
import { coreUsers, userAccounts, userProfiles, passwordResets, passwordChangeHistory, InsertUserAccount, InsertUserProfile } from "@server/db/schema/user-account";
import {
  CoreUser,
  UserAccount,
  UserProfile,
  InsertCoreUser,
  UserAccountInsert,
  UserProfileInsert,
  RegisterInput,
  SessionUser,
  updateProfileOrphanSchema,
} from "@shared/schema/user-account";
import { db, type Database } from "../../db/index";
import { createId } from "@paralleldrive/cuid2";
import { hash, compare } from "bcryptjs";
import { createDecimalValueString } from "@shared/schema/utils";

export class DatabaseUserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Core User operations
  async getCoreUser(id: CoreUser["id"]): Promise<CoreUser | undefined> {
    return this.db.query.coreUsers.findFirst({
      where: eq(coreUsers.id, id),
    });
  }

  async createCoreUser(data: InsertCoreUser): Promise<CoreUser> {
    const [user] = await this.db.insert(coreUsers).values(data).returning();
    if (!user) {
      throw new Error("Failed to create core user");
    }
    return user;
  }

  async updateCoreUser(
    id: CoreUser["id"],
    data: Partial<InsertCoreUser>
  ): Promise<CoreUser> {
    const [user] = await this.db
      .update(coreUsers)
      .set(data)
      .where(eq(coreUsers.id, id))
      .returning();

    if (!user) {
      throw new Error("Core user not found");
    }

    return user;
  }

  async deleteCoreUser(id: CoreUser["id"]): Promise<boolean> {
    const [deleted] = await this.db
      .delete(coreUsers)
      .where(eq(coreUsers.id, id))
      .returning();

    return !!deleted;
  }

  // User Account operations
  async getUserAccount(
    id: UserAccount["id"]
  ): Promise<UserAccount | undefined> {
    return this.db.query.userAccounts.findFirst({
      where: eq(userAccounts.id, id),
    });
  }

  async getUserAccountByEmail(email: string): Promise<UserAccount | undefined> {
    return this.db.query.userAccounts.findFirst({
      where: eq(userAccounts.email, email),
    });
  }

  async createUserAccount(data: UserAccountInsert): Promise<UserAccount> {
    const [account] = await this.db
      .insert(userAccounts)
      .values(data)
      .returning();
    if (!account) {
      throw new Error("Failed to create user account");
    }
    return account;
  }

  async updateUserAccount(
    id: UserAccount["id"],
    data: Partial<InsertUserAccount>
  ): Promise<UserAccount> {
    const [account] = await this.db
      .update(userAccounts)
      .set(data)
      .where(eq(userAccounts.id, id))
      .returning();

    if (!account) {
      throw new Error("User account not found");
    }

    return account;
  }

  async deleteUserAccount(id: UserAccount["id"]): Promise<boolean> {
    const [deleted] = await this.db
      .delete(userAccounts)
      .where(eq(userAccounts.id, id))
      .returning();

    return !!deleted;
  }

  // User Profile operations
  async getUserProfile(
    id: UserProfile["id"]
  ): Promise<UserProfile | undefined> {
    return this.db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, id),
    });
  }

  async createUserProfile(data: UserProfileInsert): Promise<UserProfile> {
    const [profile] = await this.db
      .insert(userProfiles)
      .values(data)
      .returning();
    if (!profile) {
      throw new Error("Failed to create user profile");
    }
    return profile;
  }

  async updateUserProfile(
    id: UserProfile["id"],
    data: Partial<InsertUserProfile>
  ): Promise<UserProfile> {
    const [profile] = await this.db
      .update(userProfiles)
      .set(data)
      .where(eq(userProfiles.id, id))
      .returning();

    if (!profile) {
      throw new Error("User profile not found");
    }

    return profile;
  }

  async updateUserProfileForUserAccount(
    userAccountId: UserAccount["id"],
    data: Partial<InsertUserProfile>
  ): Promise<UserProfile> {
    const [profile] = await this.db
      .update(userProfiles)
      .set(data)
      .where(eq(userProfiles.userAccountId, userAccountId))
      .returning();

    if (!profile) {
      throw new Error("User profile not found");
    }

    return profile;
  }

  async deleteUserProfile(id: UserProfile["id"]): Promise<boolean> {
    const [deleted] = await this.db
      .delete(userProfiles)
      .where(eq(userProfiles.id, id))
      .returning();

    return !!deleted;
  }

  async createUserComplete(user: RegisterInput): Promise<SessionUser> {
    const passwordHash = await hash(user.password, 10);

    return await db.transaction(async (tx) => {
      // Create the core user record
      const [coreUser] = await tx.insert(coreUsers).values({}).returning();

      if (!coreUser) {
        throw new Error("Failed to create core user");
      }

      // Create the user account linked to the core user
      const [userAccount] = await tx
        .insert(userAccounts)
        .values({
          coreUserId: coreUser.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber || null,
          passwordHash,
          isEmailVerified: false,
          isPhoneVerified: false,
        })
        .returning();

      if (!userAccount) {
        throw new Error("Failed to create user account");
      }

      // Create the user profile linked to the core user
      const [userProfile] = await tx
        .insert(userProfiles)
        .values({
          userAccountId: userAccount.id,
        })
        .returning();

      if (!userProfile) {
        throw new Error("Failed to create user profile");
      }

      return {
        id: coreUser.id,
        account: userAccount,
        profile: userProfile,
      };
    });
  }

  async getCompleteUserForAccount(
    userAccountId: string
  ): Promise<SessionUser | null> {
    const userAccount = await db.query.userAccounts.findFirst({
      where: eq(userAccounts.id, userAccountId),
      with: {
        coreUser: true,
        userProfile: true,
      },
    });

    if (!userAccount) {
      return null;
    }

    const { userProfile, ...rest } = userAccount;

    return {
      id: userAccount.coreUserId,
      account: rest,
      profile: userProfile,
    };
  }

  // Authentication operations
  async verifyEmail(token: string): Promise<boolean> {
    throw new Error("Not implemented");

    return true;
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    const account = await this.getUserAccountByEmail(email);
    if (!account) {
      return false;
    }

    const token = createId();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.db.insert(passwordResets).values({
      userAccountId: account.id,
      token,
      expiresAt,
    });

    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const reset = await this.db.query.passwordResets.findFirst({
      where: and(
        eq(passwordResets.token, token),
        eq(passwordResets.isCompleted, false)
      ),
    });

    if (!reset || reset.expiresAt < new Date()) {
      return false;
    }

    const passwordHash = await hash(newPassword, 10);

    // Start transaction
    await this.db.transaction(async (tx) => {
      // Update password
      await tx
        .update(userAccounts)
        .set({ passwordHash })
        .where(eq(userAccounts.id, reset.userAccountId));

      // Mark reset as completed
      await tx
        .update(passwordResets)
        .set({
          isCompleted: true,
          completedAt: new Date(),
        })
        .where(eq(passwordResets.id, reset.id));

      // Add to password history
      await tx.insert(passwordChangeHistory).values({
        userAccountId: reset.userAccountId,
        passwordHash,
        changedAt: new Date(),
      });
    });

    return true;
  }

  async changePassword(
    userAccountId: UserAccount["id"],
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const account = await this.getUserAccount(userAccountId);
    if (!account) {
      return false;
    }

    const isValid = await compare(currentPassword, account.passwordHash);
    if (!isValid) {
      return false;
    }

    const passwordHash = await hash(newPassword, 10);

    // Start transaction
    await this.db.transaction(async (tx) => {
      // Update password
      await tx
        .update(userAccounts)
        .set({ passwordHash })
        .where(eq(userAccounts.id, userAccountId));

      // Add to password history
      await tx.insert(passwordChangeHistory).values({
        userAccountId,
        passwordHash,
        changedAt: new Date(),
      });
    });

    return true;
  }
} 
