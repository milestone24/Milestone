import { AuthRequest, AuthService } from "@server/auth";
import { Router } from "express";
import asyncCatch from "./utils";
import { regExpPath, uuidRouteParam } from "@server/utils/uuid";
import { db } from "@server/db";
import { processes } from "@server/db/schema";
import { eq } from "drizzle-orm";
import {
  parseQueryParamsExpress,
  ResourceQueryBuilder,
} from "@server/utils/resource-query-builder";

const processesQueryBuilder = new ResourceQueryBuilder({
  table: processes,
  allowedSortFields: ["createdAt", "updatedAt", "key", "status"],
  allowedFilterFields: ["key", "status"],
  defaultSort: { field: "createdAt", direction: "desc" },
  maxLimit: 50,
});

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser, requireApiKey } = authService.getAuthMiddlewares();

  router.get("/processes", requireUser, async (req: AuthRequest, res) => {
    try {
      const queryParams = parseQueryParamsExpress(req.query);
      const { where, orderBy, limit, offset } =
        processesQueryBuilder.buildQuery(queryParams);
      const processesResponse = await db.query.processes.findMany({
        where,
        orderBy,
        limit,
        offset,
      });
      res.json(processesResponse);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get processes" });
    }
  });

  router.get(
    regExpPath(`/processes/${uuidRouteParam("processId")}`),
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.processId) {
        return res.status(400).json({ error: "Process ID is required" });
      }
      const process = await db
        .select()
        .from(processes)
        .where(eq(processes.id, req.params.processId));
      res.json(process);
    }
  );

  return router;
}
