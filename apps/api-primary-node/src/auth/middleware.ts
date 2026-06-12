import { Request, Response, NextFunction, RequestHandler } from "express";
import { AUTH_COOKIE_NAMES } from "./const";
import {
  ApiKeyScope,
  AuthoriseAPIKey,
  AuthoriseUser,
  AuthRequest,
  TenantType,
} from "./types";
import { runWithContext } from "../context/request-context";

const createAuthMiddleware = (
  allowedAuthTypes: TenantType[],
  authoriseUser: AuthoriseUser,
  authoriseAPIKey: AuthoriseAPIKey
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
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
            return next(new Error("Tenant not found"));
          }
          if (!("userAccountId" in req.tenant)) {
            return next(new Error("User account ID not found"));
          }

          // Wrap remaining middleware chain in request context
          return runWithContext(
            { userAccountId: authResult.tenantAccountId },
            () => next()
          );
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
            req.tenant = {
              id: authResult.tenantId,
              type: "api",
              keyType: authResult.keyType,
              scope: authResult.scope,
              userAccountId: authResult.userAccountId,
            };
            return next();
          }

          return next(new Error("Invalid API key"));
        }
      }

      // No valid auth found
      return next(new Error("Unauthorized"));
    } catch (error) {
      console.error("auth middleware error", error);
      return next(new Error("Invalid authentication"));
    }
  };
};

/**
 * Scope hierarchy for permission checking
 * Higher number = more permissions
 */
const SCOPE_HIERARCHY: Record<ApiKeyScope, number> = {
  trigger: 1,
  read: 2,
  write: 3,
  admin: 4,
};

/**
 * Middleware to require a minimum scope level for API key access.
 * For user-type auth, full access is assumed.
 */
const createScopeMiddleware = (requiredScope: ApiKeyScope): RequestHandler => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // For user-type auth, assume full access
    if (req.tenant.type === "user") {
      return next();
    }

    // For API auth, check scope
    if (req.tenant.type === "api") {
      const tenantScope = req.tenant.scope;
      if (SCOPE_HIERARCHY[tenantScope] >= SCOPE_HIERARCHY[requiredScope]) {
        return next();
      }
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return res.status(403).json({ error: "Insufficient permissions" });
  };
};

// Export the factory functions
export { createAuthMiddleware, createScopeMiddleware };
