import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { parseTimeValue, timeToExpiryDate } from "./util-time";
import { AUTH_COOKIE_NAMES } from "./const";
import { CookieOptions, ResponseWithCookiesLike, JWTRefreshTokenPayload, TokenPersistence, JWTAuthTokenPayload, RefreshTokenAttributes, JWTAuthTokenAttributes, RefreshTokenFamilyAttributes, RequestWithCookiesLike } from "./types";

export async function generateAccessToken(tokensAttributes: JWTAuthTokenAttributes, secret: string): Promise<string> {
  /**
   * We do this disection an repitition  just for clarity that the attributes and payload are the same
   */
  const { tenantId, tenantAccountId, expiry } = tokensAttributes;

  const tokenPayload : JWTAuthTokenPayload = {
    tenantId,
    tenantAccountId,
  }

  return jwt.sign(tokenPayload, secret, {
    expiresIn: parseTimeValue(expiry),
  });
}

//export async function verifyAccessToken(token: string): Promise<{ userId: string, userAccountId: string }> {
export async function verifyAccessToken(token: string, secret: string): Promise<JWTAuthTokenPayload> {
  // Should we have a zod schema to parse here for assurance
  return jwt.verify(token, secret) as JWTAuthTokenPayload;
}

export async function generateRefreshToken(tokensAttributes: RefreshTokenAttributes, tokenPersistence: TokenPersistence, secret: string): Promise<string> {
  const tokenHash = randomBytes(64).toString("hex");
  const familyId = randomBytes(32).toString("hex");
  

  const { tenantId, tenantAccountId, deviceInfo, expiry } = tokensAttributes;

  const expiresAt = timeToExpiryDate(expiry);

  await tokenPersistence.persistRefreshToken({
    tenantId,
    tenantAccountId,
    familyId: familyId,
    tokenHash: tokenHash,
    deviceInfo,
    lastUsedAt: new Date(),
    expiresAt: expiresAt,
    isRevoked: false
  });

  // await db.insert(refreshTokens).values({
  //   userAccountId: tenantAccountId,
  //   tokenHash,
  //   familyId,
  //   deviceInfo,
  //   lastUsedAt: new Date(),
  //   expiresAt,
  //   isRevoked: false,
  // });

  // We do this just assure the type of the token payload
  const tokenPayload : JWTRefreshTokenPayload = {
    tenantId,
    tenantAccountId,
    familyId
  }

  return jwt.sign(tokenPayload, secret, {
    expiresIn: parseTimeValue(expiry),
  });
}

export async function verifyRefreshToken(token: string, secret: string): Promise<JWTRefreshTokenPayload> {
  // Should we have a zod schema to parse here for assurance
  return jwt.verify(token, secret) as JWTRefreshTokenPayload;
}

export async function revokeRefreshTokenFamily(attributes: RefreshTokenFamilyAttributes, tokenPersistence: TokenPersistence ): Promise<void> {

  const { tenantId, familyId } = attributes;

  await tokenPersistence.revokeRefreshTokenFamily(tenantId, familyId);

  // await db
  //   .update(refreshTokens)
  //   .set({ isRevoked: true })
  //   .where(
  //     and(
  //       eq(refreshTokens.userAccountId, tenantAccountId),
  //       eq(refreshTokens.familyId, familyId),
  //       eq(refreshTokens.isRevoked, false)
  //     )
  //   );
}

/**
 * Clears all auth-related cookies
 * @param res Express response object
 */
export function clearAuthCookies(res: ResponseWithCookiesLike, accessTokenCookieName: string, refreshTokenCookieName:string, cookieOptions: CookieOptions): void {
  res.clearCookie(accessTokenCookieName, cookieOptions);
  res.clearCookie(refreshTokenCookieName, cookieOptions);
}

export function setAccessTokenCookie(res: ResponseWithCookiesLike, tokenCookieName:string, cookieOptions: CookieOptions, accessToken: string): void {
  res.cookie(tokenCookieName, accessToken, cookieOptions);
}

export function setRefreshTokenCookie(res: ResponseWithCookiesLike, tokenCookieName:string, cookieOptions: CookieOptions, refreshToken: string): void {
  res.cookie(tokenCookieName, refreshToken, cookieOptions);
}

export function setAuthCookies(res: ResponseWithCookiesLike, accessTokenCookieName: string, refreshTokenCookieName: string, cookieOptions: CookieOptions, accessToken: string, refreshToken: string): void {
  setAccessTokenCookie(res, accessTokenCookieName, cookieOptions, accessToken);
  setRefreshTokenCookie(res, refreshTokenCookieName, cookieOptions, refreshToken);
}

export function getRefreshTokenFromCookie(req: RequestWithCookiesLike, cooklieName: string): string | undefined {
  return req.cookies[cooklieName];
}
