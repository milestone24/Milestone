import { Router, Request } from "express";
import { AuthService, requireTenantWithUserAccountId } from "@server/auth";
import { db } from "@server/db";
import {
  projectionConfigSchema,
  assetProjectionRequestSchema,
  portfolioProjectionRequestSchema,
  ProjectionSchemas,
} from "@shared/schema/projections";
import {
  projectAssetById,
  projectPortfolio,
} from "@server/services/projections/orchestrator";
import {
  checkMilestoneProgress,
  getAllMilestonesWithProgress,
} from "@server/services/projections/milestone-tracker";
import {
  checkFIREFeasibility,
  projectToRetirement,
} from "@server/services/projections/fire-calculator";
import { regExpPath, uuidRouteParam } from "@server/utils/uuid";

// ============================================================================
// PROJECTION ROUTES
// ============================================================================

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();

  // ============================================================================
  // SINGLE ASSET PROJECTION
  // ============================================================================

  /**
   * POST /api/projections/asset/:assetId
   * Project a single asset's future value
   */
  router.post(
    regExpPath(`/asset/${uuidRouteParam("assetId")}`),
    requireUser,
    async (req: Request, res) => {
      try {
        const { assetId } = req.params;

        if (!assetId) {
          return res.status(400).json({ error: "Asset ID is required" });
        }

        const response = await requireTenantWithUserAccountId(
          req.tenant,
          async (tenant) => {
            // Validate request body
            const validationResult = assetProjectionRequestSchema.safeParse({
              assetId,
              ...req.body,
            });

            if (!validationResult.success) {
              throw new Error("Invalid request");
            }

            const { config, milestoneTarget } = validationResult.data;

            // Verify asset belongs to user
            const asset = await db.query.userAssets.findFirst({
              where: (userAssets, { eq }) => eq(userAssets.id, assetId),
            });

            if (!asset) {
              throw new Error("Asset not found");
            }

            if (asset.userAccountId !== tenant.userAccountId) {
              throw new Error("Unauthorized");
            }

            // Project asset
            const result = await projectAssetById(assetId, config, db);

            // Add milestone progress if requested
            if (milestoneTarget) {
              result.milestoneProgress = [
                {
                  milestoneId: milestoneTarget.milestoneId,
                  milestoneName: milestoneTarget.milestoneName,
                  targetValue: milestoneTarget.targetValue,
                  targetDate: milestoneTarget.targetDate,
                  projectedValueAtTarget: result.totalProjectedValue,
                  isOnTrack:
                    result.totalProjectedValue >= milestoneTarget.targetValue,
                  shortfall:
                    milestoneTarget.targetValue - result.totalProjectedValue,
                  shortfallPercentage:
                    ((milestoneTarget.targetValue -
                      result.totalProjectedValue) /
                      milestoneTarget.targetValue) *
                    100,
                },
              ];
            }

            return result;
          }
        );

        res.json(response);
      } catch (error) {
        console.error("Asset projection error:", error);
        res.status(500).json({
          error: "Failed to project asset",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // PORTFOLIO PROJECTION
  // ============================================================================

  /**
   * POST /api/projections/portfolio
   * Project entire portfolio's future value
   */
  router.post(
    regExpPath(`/portfolio`),
    requireUser,
    async (req: Request, res) => {
      try {
        const response = await requireTenantWithUserAccountId(
          req.tenant,
          async (tenant) => {
            console.log("req.body", req.body);

            // Validate request body
            const validationResult = portfolioProjectionRequestSchema.safeParse(
              req.body
            );

            console.log(
              "validationResult",
              JSON.stringify(validationResult.error)
            );

            if (!validationResult.success) {
              throw new Error("Invalid request");
            }

            const { config, milestoneTarget, fireConfig } =
              validationResult.data;

            // Project portfolio
            const result = await projectPortfolio(
              tenant.userAccountId,
              config,
              db,
              milestoneTarget
            );

            // Add FIRE progress if requested
            if (fireConfig) {
              const fireProgress = await projectToRetirement(
                tenant.userAccountId,
                fireConfig,
                config,
                db
              );
              result.fireProgress = fireProgress;
            }

            return result;
          }
        );

        res.json(response);
      } catch (error) {
        console.error("Portfolio projection error:", error);
        res.status(500).json({
          error: "Failed to project portfolio",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // MILESTONE PROJECTION
  // ============================================================================

  /**
   * POST /api/projections/milestone/:milestoneId
   * Check progress toward a specific milestone
   */
  router.post(
    regExpPath(`/milestone/${uuidRouteParam("milestoneId")}`),
    requireUser,
    async (req: Request, res) => {
      try {
        const { milestoneId } = req.params;

        if (!milestoneId) {
          return res.status(400).json({ error: "Milestone ID is required" });
        }

        const response = await requireTenantWithUserAccountId(
          req.tenant,
          async (tenant) => {
            // Validate config
            const configValidation = projectionConfigSchema.safeParse(
              req.body.config
            );

            if (!configValidation.success) {
              throw new Error("Invalid projection config");
            }

            const config = configValidation.data;

            // Verify milestone belongs to user
            const milestone = await db.query.milestones.findFirst({
              where: (milestones, { eq }) => eq(milestones.id, milestoneId),
            });

            if (!milestone) {
              throw new Error("Milestone not found");
            }

            if (milestone.userAccountId !== tenant.userAccountId) {
              throw new Error("Unauthorized");
            }

            // Check milestone progress
            return checkMilestoneProgress(milestoneId, config, db);
          }
        );

        res.json(response);
      } catch (error) {
        console.error("Milestone projection error:", error);
        res.status(500).json({
          error: "Failed to check milestone progress",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * POST /api/projections/milestones
   * Check progress for all user milestones
   */
  router.post(
    regExpPath(`/milestones`),
    requireUser,
    async (req: Request, res) => {
      try {
        const response = await requireTenantWithUserAccountId(
          req.tenant,
          async (tenant) => {
            // Validate config
            const configValidation = projectionConfigSchema.safeParse(
              req.body.config
            );

            if (!configValidation.success) {
              throw new Error("Invalid projection config");
            }

            const config = configValidation.data;

            // Get all milestones with progress
            return getAllMilestonesWithProgress(
              tenant.userAccountId,
              config,
              db
            );
          }
        );

        res.json(response);
      } catch (error) {
        console.error("Milestones projection error:", error);
        res.status(500).json({
          error: "Failed to check milestones progress",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // FIRE PROJECTION
  // ============================================================================

  /**
   * POST /api/projections/fire
   * Project FIRE retirement feasibility
   */
  router.post(regExpPath(`/fire`), requireUser, async (req: Request, res) => {
    try {
      const response = await requireTenantWithUserAccountId(
        req.tenant,
        async (tenant) => {
          // Validate config
          const configValidation = projectionConfigSchema.safeParse(
            req.body.config
          );

          if (!configValidation.success) {
            throw new Error("Invalid projection config");
          }

          const config = configValidation.data;

          // Check FIRE feasibility using saved settings
          return checkFIREFeasibility(tenant.userAccountId, config, db);
        }
      );

      res.json(response);
    } catch (error) {
      console.error("FIRE projection error:", error);
      res.status(500).json({
        error: "Failed to project FIRE retirement",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /api/projections/fire/custom
   * Project FIRE with custom configuration (not using saved settings)
   */
  router.post(
    regExpPath(`/fire/custom`),
    requireUser,
    async (req: Request, res) => {
      try {
        const response = await requireTenantWithUserAccountId(
          req.tenant,
          async (tenant) => {
            // Validate request
            const configValidation = projectionConfigSchema.safeParse(
              req.body.config
            );
            const fireConfigValidation = ProjectionSchemas.fireConfig.safeParse(
              req.body.fireConfig
            );

            if (!configValidation.success || !fireConfigValidation.success) {
              throw new Error("Invalid configuration");
            }

            const config = configValidation.data;
            const fireConfig = fireConfigValidation.data;

            // Project with custom FIRE config
            return projectToRetirement(
              tenant.userAccountId,
              fireConfig,
              config,
              db
            );
          }
        );

        res.json(response);
      } catch (error) {
        console.error("Custom FIRE projection error:", error);
        res.status(500).json({
          error: "Failed to project FIRE retirement",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  return router;
}
