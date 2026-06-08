import type { AuthServiceConfig } from "./types.js";

export type AuthCookieOptions = {
  /** HttpOnly cookie name for the session JWT. */
  cookieName: string;
  /** JWT issuer claim. */
  issuer: string;
  /** JWT audience claim. */
  audience: string;
  /** Session lifetime in seconds. */
  expiresInSeconds: number;
  /** Set Secure flag on cookies (typically true in production). */
  secureCookie: boolean;
  /** SameSite attribute for the session cookie. */
  sameSite: "Strict" | "Lax" | "None";
};

export type ResolvedAuthConfig<TUser, TApiTokenPrincipal> =
  AuthServiceConfig<TUser, TApiTokenPrincipal> & AuthCookieOptions;

export const defaultAuthCookieOptions: AuthCookieOptions = {
  cookieName: "session",
  issuer: "api-primary",
  audience: "api-primary",
  expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
  secureCookie: process.env.NODE_ENV === "production",
  sameSite: "Lax",
};

export function resolveAuthConfig<TUser, TApiTokenPrincipal>(
  config: AuthServiceConfig<TUser, TApiTokenPrincipal> &
    Partial<AuthCookieOptions>,
): ResolvedAuthConfig<TUser, TApiTokenPrincipal> {
  return {
    ...defaultAuthCookieOptions,
    ...config,
  };
}
