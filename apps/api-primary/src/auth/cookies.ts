import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { ResolvedAuthConfig } from "./config.js";
import { createSessionToken } from "./tokens.js";
import type { SessionTokenInput } from "./types.js";

export function getAuthCookieToken<TUser, TApiTokenPrincipal>(
  c: Context,
  config: ResolvedAuthConfig<TUser, TApiTokenPrincipal>,
): string | undefined {
  return getCookie(c, config.cookieName);
}

export async function setAuthCookie<TUser, TApiTokenPrincipal>(
  c: Context,
  config: ResolvedAuthConfig<TUser, TApiTokenPrincipal>,
  input: SessionTokenInput,
): Promise<void> {
  const token = await createSessionToken(config, input);

  setCookie(c, config.cookieName, token, {
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: config.sameSite,
    maxAge: config.expiresInSeconds,
    path: "/",
  });
}

export function clearAuthCookie<TUser, TApiTokenPrincipal>(
  c: Context,
  config: ResolvedAuthConfig<TUser, TApiTokenPrincipal>,
): void {
  deleteCookie(c, config.cookieName, {
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: config.sameSite,
    path: "/",
  });
}
