import { Hono } from "hono";

import type { CreateAuthResult } from "../auth/index.js";
import type { ApiPrincipal, AppUser } from "../types/app.js";

type DemoLoginBody = {
  sub?: string;
  email?: string;
};

/**
 * Development-only helper to issue a session cookie for trying GET /me.
 * Not mounted in production.
 */
export function createAuthDemoRoute(
  auth: CreateAuthResult<AppUser, ApiPrincipal>,
) {
  const route = new Hono();

  route.post("/session", async (c) => {
    const body = (await c.req.json<DemoLoginBody>().catch(() => ({}))) as DemoLoginBody;
    const sub = body.sub?.trim() || "demo-user";
    const email = body.email?.trim() || `${sub}@example.com`;

    await auth.setAuthCookie(c, { sub, email });

    return c.json({
      message: "Session cookie set. Call GET /me with credentials included.",
      sub,
      email,
    });
  });

  return route;
}
