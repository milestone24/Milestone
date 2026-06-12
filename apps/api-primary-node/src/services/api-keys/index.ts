import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  apiKeys,
  ApiKeyType,
  ApiKeyScope,
  SYSTEM_TENANT_ID,
  SelectApiKey,
} from "@/db/schema/api-keys";
import { hashApiKey } from "@/auth";

export type CreateApiKeyOptions = {
  name: string;
  scope?: ApiKeyScope;
  expiresAt?: Date;
  allowedIPs?: string[];
  allowedDomains?: string[];
  rateLimit?: number;
};

export type CreateUserApiKeyOptions = CreateApiKeyOptions & {
  userAccountId: string;
  tenantId: string;
};

export type CreateSystemApiKeyOptions = CreateApiKeyOptions & {
  /** Override the default system tenant ID if needed */
  tenantId?: string;
};

export type ApiKeyCreateResult = {
  /** The full API key - only returned once, never stored */
  key: string;
  /** The database record ID */
  id: string;
  /** The key prefix for identification */
  prefix: string;
};

/**
 * Service for creating and managing API keys
 */
export class ApiKeyService {
  private readonly db: typeof db;

  constructor(database: typeof db = db) {
    this.db = database;
  }

  /**
   * Generate a new API key with prefix
   * Key format: mk_{env}_{random}
   */
  private generateKey(
    type: ApiKeyType,
    environment: "live" | "test" = "live"
  ): {
    fullKey: string;
    keyHash: string;
    keyPrefix: string;
  } {
    const prefixMap = {
      user: { live: "mk_live_", test: "mk_test_" },
      system: { live: "mk_sys_", test: "mk_sys_test_" },
    };

    const prefix = prefixMap[type][environment];
    const randomPart = randomBytes(32).toString("base64url");
    const fullKey = `${prefix}${randomPart}`;
    const keyHash = hashApiKey(fullKey);

    return {
      fullKey,
      keyHash,
      keyPrefix: prefix,
    };
  }

  /**
   * Create an API key for a user account
   */
  async createUserKey(
    options: CreateUserApiKeyOptions
  ): Promise<ApiKeyCreateResult> {
    const {
      userAccountId,
      tenantId,
      name,
      scope = "read",
      expiresAt,
      allowedIPs,
      allowedDomains,
      rateLimit,
    } = options;

    const { fullKey, keyHash, keyPrefix } = this.generateKey("user");

    const [created] = await this.db
      .insert(apiKeys)
      .values({
        keyHash,
        keyPrefix,
        name,
        type: "user",
        scope,
        tenantId,
        userAccountId,
        expiresAt,
        allowedIPs,
        allowedDomains,
        rateLimit,
      })
      .returning({ id: apiKeys.id });

    if (!created) {
      throw new Error("Failed to create API key");
    }

    return {
      key: fullKey,
      id: created.id,
      prefix: keyPrefix,
    };
  }

  /**
   * Create a system API key for admin/service operations
   */
  async createSystemKey(
    options: CreateSystemApiKeyOptions
  ): Promise<ApiKeyCreateResult> {
    const {
      tenantId = SYSTEM_TENANT_ID,
      name,
      scope = "trigger",
      expiresAt,
      allowedIPs,
      allowedDomains,
      rateLimit,
    } = options;

    const { fullKey, keyHash, keyPrefix } = this.generateKey("system");

    const [created] = await this.db
      .insert(apiKeys)
      .values({
        keyHash,
        keyPrefix,
        name,
        type: "system",
        scope,
        tenantId,
        userAccountId: null,
        expiresAt,
        allowedIPs,
        allowedDomains,
        rateLimit,
      })
      .returning({ id: apiKeys.id });

    if (!created) {
      throw new Error("Failed to create system API key");
    }

    return {
      key: fullKey,
      id: created.id,
      prefix: keyPrefix,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeKey(keyId: string, reason?: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(apiKeys.id, keyId));
  }

  /**
   * List all API keys for a user account
   */
  async listUserKeys(userAccountId: string): Promise<SelectApiKey[]> {
    return this.db
      .select()
      .from(apiKeys)
      .where(
        and(eq(apiKeys.userAccountId, userAccountId), eq(apiKeys.type, "user"))
      );
  }

  /**
   * List all system API keys
   */
  async listSystemKeys(): Promise<SelectApiKey[]> {
    return this.db.select().from(apiKeys).where(eq(apiKeys.type, "system"));
  }

  /**
   * Get an API key by ID
   */
  async getKeyById(keyId: string): Promise<SelectApiKey | null> {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    return key ?? null;
  }

  /**
   * Update API key properties (cannot change the key itself)
   */
  async updateKey(
    keyId: string,
    updates: Partial<
      Pick<
        SelectApiKey,
        | "name"
        | "scope"
        | "allowedIPs"
        | "allowedDomains"
        | "rateLimit"
        | "expiresAt"
      >
    >
  ): Promise<void> {
    await this.db.update(apiKeys).set(updates).where(eq(apiKeys.id, keyId));
  }

  /**
   * Delete an API key permanently
   */
  async deleteKey(keyId: string): Promise<void> {
    await this.db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  }
}

// Default instance
export const apiKeyService = new ApiKeyService();
