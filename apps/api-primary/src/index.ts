import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import {
  createAuth,
  isAuthError,
  type AuthContextVariables,
  type AuthErrorResponse,
} from "./auth/index.js";
import { loadEnv } from "./env.js";
import { healthRoute } from "./routes/health.js";
import { createAuthDemoRoute } from "./routes/auth-demo.js";
import { createMeRoute } from "./routes/me.js";
import type { ApiPrincipal, AppUser } from "./types/app.js";

const env = loadEnv();

const auth = createAuth<AppUser, ApiPrincipal>({
  jwtSecret: env.AUTH_JWT_SECRET,
  findUser: async (filters) => {
    // TODO: resolve user from your persistence layer
    return {
      id: filters.id,
      email: filters.email ?? `${filters.id}@example.com`,
    };
  },
  verifyApiToken: async (_token) => {
    // TODO: validate API token against your persistence layer
    return null;
  },
});

const app = new Hono<{
  Variables: AuthContextVariables<AppUser, ApiPrincipal>;
}>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.route("/health", healthRoute);
app.route("/me", createMeRoute(auth));

if (env.NODE_ENV !== "production") {
  app.route("/auth/demo", createAuthDemoRoute(auth));
}

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  if (isAuthError(err)) {
    const body: AuthErrorResponse = {
      error: err.message,
      code: err.code,
    };
    return c.json(body, err.status as 401);
  }

  console.error(err);
  const message =
    env.NODE_ENV === "production" ? "Internal Server Error" : err.message;
  return c.json({ error: message }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API server running on http://localhost:${env.PORT}`);
});

export { app, auth };
