import type { Context } from "hono";

import { AuthError } from "./errors.js";
import type { AuthContextVariables } from "./types.js";

export function getAuthUser<TUser, TApiTokenPrincipal>(
  c: Context<{ Variables: AuthContextVariables<TUser, TApiTokenPrincipal> }>,
): TUser {
  const user = c.get("authUser");
  if (!user) {
    throw new AuthError("Authenticated user not found in context", {
      code: "UNAUTHORIZED",
    });
  }
  return user;
}

export function getApiTokenPrincipal<TUser, TApiTokenPrincipal>(
  c: Context<{ Variables: AuthContextVariables<TUser, TApiTokenPrincipal> }>,
): TApiTokenPrincipal {
  const principal = c.get("apiTokenPrincipal");
  if (!principal) {
    throw new AuthError("API token principal not found in context", {
      code: "UNAUTHORIZED",
    });
  }
  return principal;
}

export function hasAuthUser<TUser, TApiTokenPrincipal>(
  c: Context<{ Variables: AuthContextVariables<TUser, TApiTokenPrincipal> }>,
): boolean {
  return c.get("authUser") !== undefined;
}

export function hasApiTokenPrincipal<TUser, TApiTokenPrincipal>(
  c: Context<{ Variables: AuthContextVariables<TUser, TApiTokenPrincipal> }>,
): boolean {
  return c.get("apiTokenPrincipal") !== undefined;
}
