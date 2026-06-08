import { sign, verify } from "hono/jwt";

import type { ResolvedAuthConfig } from "./config.js";
import { AuthError } from "./errors.js";
import type { JwtAuthClaims, SessionTokenInput } from "./types.js";

const JWT_ALG = "HS256";

export async function createSessionToken<TUser, TApiTokenPrincipal>(
  config: ResolvedAuthConfig<TUser, TApiTokenPrincipal>,
  input: SessionTokenInput,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtAuthClaims = {
    sub: input.sub,
    email: input.email,
    roles: input.roles,
    permissions: input.permissions,
    iss: config.issuer,
    aud: config.audience,
    iat: now,
    exp: now + config.expiresInSeconds,
  };

  return sign(payload, config.jwtSecret, JWT_ALG);
}

export async function verifySessionToken<TUser, TApiTokenPrincipal>(
  config: ResolvedAuthConfig<TUser, TApiTokenPrincipal>,
  token: string,
): Promise<JwtAuthClaims> {
  let payload: JwtAuthClaims;

  try {
    payload = (await verify(
      token,
      config.jwtSecret,
      JWT_ALG,
    )) as JwtAuthClaims;
  } catch {
    throw new AuthError("Invalid or expired session", {
      code: "INVALID_TOKEN",
    });
  }

  if (!payload.sub) {
    throw new AuthError("Invalid session token", { code: "INVALID_TOKEN" });
  }

  if (payload.iss && payload.iss !== config.issuer) {
    throw new AuthError("Invalid session issuer", { code: "INVALID_TOKEN" });
  }

  const aud = payload.aud;
  if (aud) {
    const audiences = Array.isArray(aud) ? aud : [aud];
    if (!audiences.includes(config.audience)) {
      throw new AuthError("Invalid session audience", {
        code: "INVALID_TOKEN",
      });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new AuthError("Session expired", { code: "SESSION_EXPIRED" });
  }

  return payload;
}
