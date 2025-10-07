import { AuthRequest, AuthService } from "@server/auth";
import { Router } from "express";
import asyncCatch from "./utils";
import { uuidRouteParam } from "@server/utils/uuid";

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser, requireApiKey } = authService.getAuthMiddlewares();

  router.get(
    "/processes",
    requireUser,
    asyncCatch(async (req: AuthRequest, res) => {
      res.json([]);
    })
  );

  router.get(
    `/processes/${uuidRouteParam("processId")}`,
    requireUser,
    asyncCatch(async (req: AuthRequest, res) => {
      res.json({});
    })
  );

  return router;
}
