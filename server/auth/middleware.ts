import { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAMES } from "./const";
import { AuthoriseAPIKey, AuthoriseUser, AuthRequest, TenantType } from "./types";
import { IncomingHttpHeaders } from "node:http";

const createAuthMiddleware = (allowedAuthTypes: TenantType[], authoriseUser: AuthoriseUser, authoriseAPIKey: AuthoriseAPIKey) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const t = req.tenant;

    try {
      // Try browser session auth if allowed
      if (allowedAuthTypes.includes("user")) {
        const accessToken = req.cookies[AUTH_COOKIE_NAMES.ACCESS_TOKEN];
        const refreshToken = req.cookies[AUTH_COOKIE_NAMES.REFRESH_TOKEN];

        const authResult = await authoriseUser(
          {
            accessToken,
            refreshToken,
            userAgent: req.headers["user-agent"],
          },
          res
        );

        if (authResult) {
          req.tenant = {
            id: authResult.tenantId,
            type: "user",
            userAccountId: authResult.tenantAccountId,
          };

          if (!("tenant" in req)) {
            next(new Error("Tenant not found"));
          }
          if (!("userAccountId" in req.tenant)) {
            next(new Error("User account ID not found"));
          }
          return next();
        }
      }

      // Try API auth if allowed
      if (allowedAuthTypes.includes("api")) {
        const apiKey = req.headers["x-api-key"] as string | undefined;

        if (apiKey) {
          const authResult = await authoriseAPIKey({
            apiKey,
          });

          if (authResult) {
            req.tenant = { id: authResult.tenantId, type: "api" };
            return next();
          }
          // TODO: Implement API key validation
          // const apiClient = await validateApiKey(apiKey);
          // req.tenant = { id: apiClient.id, type: 'api' };

          throw new Error("API key validation not implemented");
        }
      }

      // No valid auth found
      //return res.status(401).json({ error: "Unauthorized" });
      return next(new Error("Unauthorized"));
    } catch (error) {
      console.error("auth middleware error", error);
      //return res.status(401).json({ error: "Invalid authentication" });
      return next(new Error("Invalid authentication"));
    }
  };
};

// Export the factory function for custom auth requirements
export { createAuthMiddleware }; 


