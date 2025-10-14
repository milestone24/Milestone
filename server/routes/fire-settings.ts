import { Router } from "express";
import { z } from "zod";
import { fireSettingsInsertSchema } from "@shared/schema";
import {
  AuthRequest,
  AuthService,
  requireTenantWithUserAccountId,
} from "../auth";
import { db } from "@server/db";
import { DatabaseFireSettingsService } from "@server/services/fire-settings/database";
import { regExpPath } from "@server/utils/uuid";

const fireSettingsService = new DatabaseFireSettingsService(db);

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser, requireApiKey } = authService.getAuthMiddlewares();

  // Get FIRE settings by user account ID
  router.get(regExpPath("/"), requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        if (!tenant.userAccountId) {
          return res
            .status(400)
            .json({ message: "User account ID is required" });
        }

        const settings = await fireSettingsService.getByUserAccountId(
          tenant.userAccountId
        );

        return settings;
      }
    );

    res.json(response);
  });

  // Create FIRE settings
  router.post(regExpPath("/"), requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        if (!tenant.userAccountId) {
          return res
            .status(400)
            .json({ message: "User account ID is required" });
        }

        try {
          const settingsData = fireSettingsInsertSchema.parse(req.body);
          const settings = await fireSettingsService.create(settingsData);
          return settings;
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({
              message: "Invalid FIRE settings data",
              errors: error.errors,
            });
          }
          res.status(500).json({ message: "Failed to create FIRE settings" });
        }
      }
    );

    res.json(response);
  });

  router.patch(regExpPath("/"), requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        if (!tenant.userAccountId) {
          return res
            .status(400)
            .json({ message: "User account ID is required" });
        }

        try {
          const userAccountId = req.params.userAccountId;
          const settingsData = fireSettingsInsertSchema
            .partial()
            .parse(req.body);
          const settings = await fireSettingsService.updateByUserAccountId(
            tenant.userAccountId,
            settingsData
          );
          return settings;
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({
              message: "Invalid FIRE settings data",
              errors: error.errors,
            });
          }
          if (
            error instanceof Error &&
            error.message === "FIRE settings not found"
          ) {
            return res.status(404).json({ message: "FIRE settings not found" });
          }
          res.status(500).json({ message: "Failed to update FIRE settings" });
        }
      }
    );

    res.json(response);
  });

  /**
   * Tenant via API Key routes
   * All to be checked before API Key use is allowed
   */

  // Get FIRE settings by ID
  //This is really only for API Key users
  router.get("/:id", requireApiKey, async (req: AuthRequest, res) => {
    try {
      const settingsId = req.params.id;

      if (!settingsId) {
        return res
          .status(400)
          .json({ message: "FIRE settings ID is required" });
      }

      const settings = await fireSettingsService.get(settingsId);

      if (!settings) {
        return res.status(404).json({ message: "FIRE settings not found" });
      }

      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get FIRE settings" });
    }
  });

  // Get FIRE settings by user account ID
  //This is really only for API Key users
  router.get(
    "/user/:userAccountId",
    requireApiKey,
    async (req: AuthRequest, res) => {
      if (!req.params.userAccountId) {
        return res.status(400).json({ message: "User account ID is required" });
      }

      try {
        const userAccountId = req.params.userAccountId;
        const settings = await fireSettingsService.getByUserAccountId(
          userAccountId
        );

        if (!settings) {
          return res.status(404).json({ message: "FIRE settings not found" });
        }

        res.json(settings);
      } catch (error) {
        res.status(500).json({ message: "Failed to get FIRE settings" });
      }
    }
  );

  // Update FIRE settings
  router.patch("/:id", requireApiKey, async (req: AuthRequest, res) => {
    try {
      if (!req.params.id) {
        return res
          .status(400)
          .json({ message: "FIRE settings ID is required" });
      }

      const settingsId = req.params.id;
      const settingsData = fireSettingsInsertSchema.partial().parse(req.body);
      const settings = await fireSettingsService.update(
        settingsId,
        settingsData
      );
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid FIRE settings data",
          errors: error.errors,
        });
      }
      if (
        error instanceof Error &&
        error.message === "FIRE settings not found"
      ) {
        return res.status(404).json({ message: "FIRE settings not found" });
      }
      res.status(500).json({ message: "Failed to update FIRE settings" });
    }
  });

  // Delete FIRE settings
  router.delete("/:id", requireApiKey, async (req: AuthRequest, res) => {
    try {
      const settingsId = req.params.id;

      if (!settingsId) {
        return res
          .status(400)
          .json({ message: "FIRE settings ID is required" });
      }

      const success = await fireSettingsService.delete(settingsId);

      if (!success) {
        return res.status(404).json({ message: "FIRE settings not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete FIRE settings" });
    }
  });

  // Update FIRE settings by user account ID
  router.patch(
    "/user/:userAccountId",
    requireApiKey,
    async (req: AuthRequest, res) => {
      if (!req.params.userAccountId) {
        return res.status(400).json({ message: "User account ID is required" });
      }

      try {
        const userAccountId = req.params.userAccountId;
        const settingsData = fireSettingsInsertSchema.partial().parse(req.body);
        const settings = await fireSettingsService.updateByUserAccountId(
          userAccountId,
          settingsData
        );
        res.json(settings);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid FIRE settings data",
            errors: error.errors,
          });
        }
        if (
          error instanceof Error &&
          error.message === "FIRE settings not found"
        ) {
          return res.status(404).json({ message: "FIRE settings not found" });
        }
        res.status(500).json({ message: "Failed to update FIRE settings" });
      }
    }
  );

  return router;
}
