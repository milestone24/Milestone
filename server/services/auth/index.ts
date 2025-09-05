import { refreshTokens } from "@server/db/schema/user-account";
import { AuthService } from "../../auth";
import { and, eq } from "drizzle-orm";
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
    }
  }
});

export default authService;
