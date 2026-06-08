import {
  clearAuthCookie,
  getAuthCookieToken,
  setAuthCookie,
} from "./cookies.js";
import type { AuthCookieOptions } from "./config.js";
import {
  defaultAuthCookieOptions,
  resolveAuthConfig,
} from "./config.js";
import {
  getApiTokenPrincipal,
  getAuthUser,
  hasApiTokenPrincipal,
  hasAuthUser,
} from "./context.js";
import { AuthError, isAuthError } from "./errors.js";
import { createAuthMiddleware } from "./middleware.js";
import { createSessionToken, verifySessionToken } from "./tokens.js";
import type {
  AuthContextVariables,
  AuthErrorResponse,
  AuthServiceConfig,
  AuthUserLookup,
  JwtAuthClaims,
  SessionTokenInput,
} from "./types.js";

export type CreateAuthResult<TUser, TApiTokenPrincipal> = {
  config: ReturnType<typeof resolveAuthConfig<TUser, TApiTokenPrincipal>>;
  requireCookieAuth: ReturnType<
    typeof createAuthMiddleware<TUser, TApiTokenPrincipal>
  >["requireCookieAuth"];
  requireApiToken: ReturnType<
    typeof createAuthMiddleware<TUser, TApiTokenPrincipal>
  >["requireApiToken"];
  requireAnyAuth: ReturnType<
    typeof createAuthMiddleware<TUser, TApiTokenPrincipal>
  >["requireAnyAuth"];
  setAuthCookie: (
    c: Parameters<typeof setAuthCookie<TUser, TApiTokenPrincipal>>[0],
    input: SessionTokenInput,
  ) => Promise<void>;
  clearAuthCookie: (
    c: Parameters<typeof clearAuthCookie<TUser, TApiTokenPrincipal>>[0],
  ) => void;
  getAuthCookieToken: (
    c: Parameters<typeof getAuthCookieToken<TUser, TApiTokenPrincipal>>[0],
  ) => string | undefined;
  createSessionToken: (input: SessionTokenInput) => Promise<string>;
  verifySessionToken: (token: string) => Promise<JwtAuthClaims>;
};

/**
 * Instantiate the auth module with persistence supplied via callbacks.
 */
export function createAuth<TUser, TApiTokenPrincipal>(
  serviceConfig: AuthServiceConfig<TUser, TApiTokenPrincipal> &
    Partial<AuthCookieOptions>,
): CreateAuthResult<TUser, TApiTokenPrincipal> {
  const config = resolveAuthConfig(serviceConfig);
  const middleware = createAuthMiddleware(serviceConfig);

  return {
    config,
    requireCookieAuth: middleware.requireCookieAuth,
    requireApiToken: middleware.requireApiToken,
    requireAnyAuth: middleware.requireAnyAuth,
    setAuthCookie: (c, input) => setAuthCookie(c, config, input),
    clearAuthCookie: (c) => clearAuthCookie(c, config),
    getAuthCookieToken: (c) => getAuthCookieToken(c, config),
    createSessionToken: (input) => createSessionToken(config, input),
    verifySessionToken: (token) => verifySessionToken(config, token),
  };
}

export {
  AuthError,
  isAuthError,
  getAuthUser,
  getApiTokenPrincipal,
  hasAuthUser,
  hasApiTokenPrincipal,
  resolveAuthConfig,
  defaultAuthCookieOptions,
};

export type {
  AuthContextVariables,
  AuthCookieOptions,
  AuthErrorResponse,
  AuthServiceConfig,
  AuthUserLookup,
  JwtAuthClaims,
  SessionTokenInput,
};
