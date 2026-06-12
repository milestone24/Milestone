//import { refreshTokens } from "@db/schema";
import { createHash } from "crypto";
import { clearAuthCookies, generateRefreshToken, setAuthCookies } from "./token";
import { generateAccessToken } from "./token";
import { verifyAccessToken, verifyRefreshToken } from "./token";
//import { db } from "@db/connection";
import { AuthorizeAPIKeyAttributesExtended, AuthorizeUserAttributesExtended, AuthorizeUserResult, AuthorizeTenantResult, CookieOptions, ResponseWithCookiesLike, TokenPersistence } from "./types";

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function authorizeUser(
  attributes: AuthorizeUserAttributesExtended,
  setAuthCookies: (res: ResponseWithCookiesLike, accessToken: string, refreshToken: string) => void,
  clearAuthCookies: (res: ResponseWithCookiesLike) => void,
  tokenPersistence: TokenPersistence,
  res: ResponseWithCookiesLike
): Promise<AuthorizeUserResult | null> {
  const { accessToken, accessTokenSecret, refreshToken, refreshTokenSecret, userAgent, accessTokenExpiry, refreshTokenExpiry } = attributes;
  if (accessToken && refreshToken) {
    try {
      const {
        tenantId,
        tenantAccountId
      } = await verifyAccessToken(accessToken, accessTokenSecret);
      return { tenantId, tenantAccountId, accessToken, refreshToken };
    } catch (error) {
      // Access token invalid or expired, try refresh token
      if (refreshToken) {
        try {
          const {
            tenantId,
            tenantAccountId,
            familyId
          } = await verifyRefreshToken(refreshToken, refreshTokenSecret);

          const persistedToken = await tokenPersistence.getRefreshToken(tenantAccountId, familyId);
          
          // Verify refresh token exists and is not revoked
          // const existingToken = await db.query.refreshTokens.findFirst({
          //   where: and(
          //     eq(refreshTokens.userAccountId, decoded.userAccountId),
          //     eq(refreshTokens.familyId, decoded.familyId),
          //     eq(refreshTokens.isRevoked, false)
          //   ),
          // });

          if (!persistedToken) {
            clearAuthCookies(res);
            return null;
          }

          // Check if token is expired in database
          if (new Date(persistedToken.expiresAt) < new Date()) {

            await tokenPersistence.revokeRefreshTokenFamily(tenantId, familyId);

            // await db
            //   .update(refreshTokens)
            //   .set({ isRevoked: true })
            //   .where(eq(refreshTokens.id, persistedToken.id));
            // clearAuthCookies(res, cookieOptions);
            return null;
          }

          // Generate new tokens
          const newAccessToken = await generateAccessToken({
            tenantId,
            tenantAccountId,
            expiry: accessTokenExpiry
          }, accessTokenSecret);
          const newRefreshToken = await generateRefreshToken({
            tenantId,
            tenantAccountId,
            deviceInfo: userAgent || "unknown",
            expiry: refreshTokenExpiry
          }, tokenPersistence, refreshTokenSecret);

          setAuthCookies(res, newAccessToken, newRefreshToken);

          return {
            tenantId,
            tenantAccountId,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
          };
        } catch (error) {
          clearAuthCookies(res);
          return null;
        }
      }
    }
  }
  return null;
}

export async function authorizeAPIKey(
  attributes: AuthorizeAPIKeyAttributesExtended,
  tokenPersistence: TokenPersistence,
): Promise<AuthorizeTenantResult | null> {

  const { apiKey, reqDomain, reqIP } = attributes;
  
  // Hash the incoming key to compare against stored hash
  const keyHash = hashApiKey(apiKey);
  
  const apiKeyEntity = await tokenPersistence.getAPIKeyByHash(keyHash);

  if (!apiKeyEntity) {
    return null;
  }

  const { 
    id,
    expiresAt, 
    allowedDomains, 
    allowedIPs, 
    isRevoked,
    tenantId,
    type,
    scope,
    userAccountId,
  } = apiKeyEntity;

  // Check if revoked
  if (isRevoked) {
    return null;
  }

  // Check expiration
  if (expiresAt && expiresAt < new Date()) {
    return null;
  }

  // Check IP restrictions (if configured)
  if (allowedIPs && allowedIPs.length > 0 && reqIP) {
    if (!allowedIPs.includes(reqIP)) {
      return null;
    }
  }

  // Check domain restrictions (if configured)
  if (allowedDomains && allowedDomains.length > 0 && reqDomain) {
    if (!allowedDomains.includes(reqDomain)) {
      return null;
    }
  }

  // Update last used timestamp (fire and forget)
  tokenPersistence.updateAPIKeyLastUsed(id).catch(() => {});

  return { 
    tenantId,
    keyType: type,
    scope,
    userAccountId: userAccountId ?? undefined,
  };
}
