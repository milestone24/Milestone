/**
 * Temporary monorepo transition: serve the built web client from the API process.
 *
 * Pre-monorepo, production ran a single bundled Node server that served both API
 * routes and the Vite client build from `public/`. During monorepo migration the
 * client lives in `apps/client-primary` and normally runs on its own dev server;
 * only the legacy Docker image still bundles API + client together.
 *
 * Enable explicitly via `SERVE_CLIENT_STATIC=true` (set in the root Dockerfile).
 * Remove this module once production serves the client separately from the API.
 */
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const CLIENT_STATIC_ROOT = path.join(process.cwd(), "public");

export function shouldServeClientStatic(): boolean {
  return process.env.SERVE_CLIENT_STATIC === "true";
}

export function serveClientStatic(app: Express): void {
  const indexPath = path.join(CLIENT_STATIC_ROOT, "index.html");

  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `SERVE_CLIENT_STATIC is enabled but client build not found at ${CLIENT_STATIC_ROOT}. Build the client first.`,
    );
  }

  app.use(express.static(CLIENT_STATIC_ROOT));

  app.use("/*all", (_req, res) => {
    res.sendFile(indexPath);
  });
}
