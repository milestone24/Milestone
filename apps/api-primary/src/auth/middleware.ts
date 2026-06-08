import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { getAuthCookieToken } from "./cookies.js";
import type { ResolvedAuthConfig } from "./config.js";
import { AuthError, isAuthError } from "./errors.js";
import { verifySessionToken } from "./tokens.js";
import type {
  AuthContextVariables,
  AuthErrorResponse,
  AuthServiceConfig,
} from "./types.js";
import type { AuthCookieOptions } from "./config.js";
import { resolveAuthConfig } from "./config.js";

type AuthEnv<TUser, TApiTokenPrincipal> = {
  Variables: AuthContextVariables<TUser, TApiTokenPrincipal>;
};

function unauthorizedResponse(c: Context, error: AuthError): Response {
  const body: AuthErrorResponse = {
    error: error.message,
    code: error.code,
  };
  return c.json(body, error.status as 401);
}

function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export function createAuthMiddleware<TUser, TApiTokenPrincipal>(
  rawConfig: AuthServiceConfig<TUser, TApiTokenPrincipal> &
    Partial<AuthCookieOptions>,
) {
  const config = resolveAuthConfig(rawConfig);

  const requireCookieAuth = createMiddleware<AuthEnv<TUser, TApiTokenPrincipal>>(
    async (c, next) => {
      try {
        const token = getAuthCookieToken(c, config);
        if (!token) {
          throw new AuthError("Missing session cookie", {
            code: "UNAUTHORIZED",
          });
        }

        const claims = await verifySessionToken(config, token);
        const user = await config.findUser({
          id: claims.sub,
          email: claims.email,
        });

        if (!user) {
          throw new AuthError("User not found", { code: "USER_NOT_FOUND" });
        }

        c.set("authUser", user);
        await next();
      } catch (error) {
        if (isAuthError(error)) {
          return unauthorizedResponse(c, error);
        }
        throw error;
      }
    },
  );

  const requireApiToken = createMiddleware<AuthEnv<TUser, TApiTokenPrincipal>>(
    async (c, next) => {
      try {
        const token = parseBearerToken(c.req.header("Authorization"));
        if (!token) {
          throw new AuthError("Missing or invalid Authorization header", {
            code: "UNAUTHORIZED",
          });
        }

        const principal = await config.verifyApiToken(token);
        if (!principal) {
          throw new AuthError("Invalid API token", { code: "INVALID_TOKEN" });
        }

        c.set("apiTokenPrincipal", principal);
        await next();
      } catch (error) {
        if (isAuthError(error)) {
          return unauthorizedResponse(c, error);
        }
        throw error;
      }
    },
  );

  const requireAnyAuth = createMiddleware<AuthEnv<TUser, TApiTokenPrincipal>>(
    async (c, next) => {
      const cookieToken = getAuthCookieToken(c, config);
      if (cookieToken) {
        try {
          const claims = await verifySessionToken(config, cookieToken);
          const user = await config.findUser({
            id: claims.sub,
            email: claims.email,
          });
          if (user) {
            c.set("authUser", user);
            await next();
            return;
          }
        } catch {
          // Fall through to API token attempt
        }
      }

      const bearerToken = parseBearerToken(c.req.header("Authorization"));
      if (bearerToken) {
        const principal = await config.verifyApiToken(bearerToken);
        if (principal) {
          c.set("apiTokenPrincipal", principal);
          await next();
          return;
        }
      }

      return unauthorizedResponse(
        c,
        new AuthError("Authentication required", { code: "UNAUTHORIZED" }),
      );
    },
  );

  return {
    config,
    requireCookieAuth,
    requireApiToken,
    requireAnyAuth,
  };
}

export type AuthMiddleware<TUser, TApiTokenPrincipal> = ReturnType<
  typeof createAuthMiddleware<TUser, TApiTokenPrincipal>
>;
