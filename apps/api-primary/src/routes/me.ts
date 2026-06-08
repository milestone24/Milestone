import { Hono } from "hono";

import { getAuthUser } from "../auth/index.js";
import type { CreateAuthResult } from "../auth/index.js";
import type { AuthContextVariables, JwtAuthClaims } from "../auth/index.js";
import type { ApiPrincipal, AppUser } from "../types/app.js";

export type MeResponse = {
  user: AppUser;
  session: {
    subject: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    issuedAt?: string;
    expiresAt: string;
  };
};

function toSessionSummary(claims: JwtAuthClaims): MeResponse["session"] {
  return {
    subject: claims.sub,
    email: claims.email,
    roles: claims.roles,
    permissions: claims.permissions,
    issuedAt:
      claims.iat !== undefined
        ? new Date(claims.iat * 1000).toISOString()
        : undefined,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

/**
 * Current user + session details (cookie auth).
 * Mount at `/me` after wiring `createAuth` in the app entrypoint.
 */
export function createMeRoute(
  auth: CreateAuthResult<AppUser, ApiPrincipal>,
) {
  const meRoute = new Hono<{
    Variables: AuthContextVariables<AppUser, ApiPrincipal>;
  }>();

  meRoute.use("*", auth.requireCookieAuth);

  meRoute.get("/", async (c) => {
    const user = getAuthUser(c);
    const token = auth.getAuthCookieToken(c);
    const claims = token ? await auth.verifySessionToken(token) : null;

    const body: MeResponse = {
      user,
      session: claims
        ? toSessionSummary(claims)
        : {
            subject: user.id,
            email: user.email,
            expiresAt: new Date(0).toISOString(),
          },
    };

    return c.json(body);
  });

  return meRoute;
}
