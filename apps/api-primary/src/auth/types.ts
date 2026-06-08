/**
 * Persistence-agnostic auth contracts.
 * Implement callbacks in AuthServiceConfig at the application boundary.
 */

/** Lookup filters passed to findUser after JWT verification. */
export type AuthUserLookup = {
  id: string;
  email?: string;
};

/** Claims stored in the stateless session JWT (cookie). */
export type JwtAuthClaims = {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp: number;
};

/** Input for issuing a new session token. */
export type SessionTokenInput = {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
};

/** Standard JSON error body for auth failures. */
export type AuthErrorResponse = {
  error: string;
  code?: string;
};

/**
 * Required service callbacks — no persistence logic in the auth module.
 */
export type AuthServiceConfig<TUser, TApiTokenPrincipal> = {
  jwtSecret: string;
  findUser: (
    filters: AuthUserLookup,
  ) => Promise<TUser | null> | TUser | null;
  verifyApiToken: (
    token: string,
  ) => Promise<TApiTokenPrincipal | null> | TApiTokenPrincipal | null;
};

/** Hono context variable keys used by auth middleware. */
export type AuthContextVariables<TUser, TApiTokenPrincipal> = {
  authUser: TUser;
  apiTokenPrincipal: TApiTokenPrincipal;
};
