import { refreshTokens } from "@/db/schema/user-account";
import { apiKeys } from "@/db/schema/api-keys";
import { AuthService } from "../../auth";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";

const authService = new AuthService({
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "bode-tc-property-secret",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "bode-tc-property-refresh-secret",
  accessTokenExpiry: "1h",
  refreshTokenExpiry: "7d",
  cookieDomain: process.env.COOKIE_DOMAIN || "localhost",
  tokenPersistence: {
    persistRefreshToken: async (tokenInsert) => {
      const [refreshToken] = await db.insert(refreshTokens).values({
        tenantId: tokenInsert.tenantId,
        userAccountId: tokenInsert.tenantAccountId,
        tokenHash: tokenInsert.tokenHash,
        familyId: tokenInsert.familyId,
        deviceInfo: tokenInsert.deviceInfo,
        lastUsedAt: tokenInsert.lastUsedAt,
        expiresAt: tokenInsert.expiresAt,
        isRevoked: tokenInsert.isRevoked,
      }).returning();

      if (!refreshToken) {
        throw new Error("Failed to persist refresh token");
      }

      const { userAccountId, deviceInfo,  ...rest} = refreshToken;

      return {
        ...rest,
        tenantAccountId: userAccountId,
        deviceInfo: deviceInfo ?? ""
      };
    },

    getRefreshToken: async (tenantAccountId, familyId) => {
      const [refreshToken] = await db.select().from(refreshTokens).where(and(eq(refreshTokens.userAccountId, tenantAccountId), eq(refreshTokens.familyId, familyId)));
      if (!refreshToken) {
        throw new Error("Refresh token not found");
      }
      const { userAccountId, deviceInfo,  ...rest} = refreshToken;
      return {
        ...rest,
        tenantAccountId: userAccountId,
        deviceInfo: deviceInfo ?? ""
      };
    },

    revokeRefreshTokenFamily: async (tenantAccountId, familyId) => {
      await db.update(refreshTokens).set({ isRevoked: true }).where(and(eq(refreshTokens.userAccountId, tenantAccountId), eq(refreshTokens.familyId, familyId)));
    },

    /** @deprecated Use getAPIKeyByHash instead */
    getAPIKey: async (apiKey: string) => {
      return {
        id: "123",
        key: apiKey,
        deviceInfo: null,
        isRevoked: false,
        expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        lastUsedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        allowedDomains: [],
        allowedIPs: [],
      }
    },

    getAPIKeyByHash: async (keyHash: string) => {
      const [apiKey] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash));

      if (!apiKey) {
        return null;
      }

      return {
        id: apiKey.id,
        keyHash: apiKey.keyHash,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        type: apiKey.type,
        scope: apiKey.scope,
        tenantId: apiKey.tenantId,
        userAccountId: apiKey.userAccountId,
        allowedIPs: apiKey.allowedIPs,
        allowedDomains: apiKey.allowedDomains,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        isRevoked: apiKey.isRevoked,
        lastUsedAt: apiKey.lastUsedAt,
      };
    },

    updateAPIKeyLastUsed: async (apiKeyId: string) => {
      await db
        .update(apiKeys)
        .set({ 
          lastUsedAt: new Date(),
          usageCount: sql`${apiKeys.usageCount} + 1`,
        })
        .where(eq(apiKeys.id, apiKeyId));
    },
  }
});

export default authService;
