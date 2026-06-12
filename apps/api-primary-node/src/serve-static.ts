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
