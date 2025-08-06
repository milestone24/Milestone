import { Router } from "express";
import {
  AuthRequest,
  AuthService,
} from "server/auth";
import { parseQueryParamsExpress } from "@server/utils/resource-query-builder";
import { 
  securityInsertSchema,
} from "@shared/schema";
import { uuidRouteParam } from "@server/utils/uuid";
import { factory as securityServiceFactory } from "@server/services/securities";

const securityService = securityServiceFactory();

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();

  // Securities CRUD Operations
  router.get("/", requireUser, async (req: AuthRequest, res) => {
    const queryParams = parseQueryParamsExpress(req.query);
    const securities = await securityService.getCachedSecurities(queryParams);
    res.json(securities);
  });

  router.get(
    `/${uuidRouteParam("securityId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const security = await securityService.getCachedSecurity(req.params.securityId);
      res.json(security);
    }
  );

  router.post("/", requireUser, async (req: AuthRequest, res) => {
    const data = securityInsertSchema.parse(req.body);
    const security = await securityService.createOrFindCachedSecurity(data);
    res.json(security);
  });

  router.put(
    `/${uuidRouteParam("securityId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const data = securityInsertSchema.parse(req.body);
      const security = await securityService.updateCachedSecurity(
        req.params.securityId,
        data
      );
      res.json(security);
    }
  );

  router.delete(
    `/${uuidRouteParam("securityId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const result = await securityService.deleteCachedSecurity(req.params.securityId);
      res.json({ success: result });
    }
  );

  // Securities Search (Hybrid: Cache + External API)
  router.get("/search", requireUser, async (req: AuthRequest, res) => {
    const identifiers = req.query.q;

    if (!identifiers || typeof identifiers !== 'string') {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    
    const query = identifiers.trim();
    const minLength = 2; // Minimum query length to avoid too many results
    
    if (query.length < minLength) {
      return res.status(400).json({ 
        error: `Query must be at least ${minLength} characters long` 
      });
    }

    try {

      const results = await securityService.findSecurities([query]);
      res.json(results);
      
    } catch (error) {
      console.error('Securities search error:', error);
      res.status(500).json({ error: 'Security search failed' });
    }
  });

  return router;
}
