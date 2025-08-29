import { Router } from "express";
import { z } from "zod";
import { fireSettingsInsertSchema } from "@shared/schema";
import { AuthRequest, AuthService } from "../auth";
import { db } from "@server/db";
import { DatabaseFireSettingsService } from "@server/services/fire-settings/database";

const fireSettingsService = new DatabaseFireSettingsService(db);

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();

  // Get FIRE settings by ID
  router.get("/:id", requireUser, async (req: AuthRequest, res) => {
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
  router.get(
    "/user/:userAccountId",
    requireUser,
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

  // Create FIRE settings
  router.post("/", requireUser, async (req: AuthRequest, res) => {
    try {
      const settingsData = fireSettingsInsertSchema.parse(req.body);
      const settings = await fireSettingsService.create(settingsData);
      res.status(201).json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid FIRE settings data",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to create FIRE settings" });
    }
  });

  // Update FIRE settings
  router.patch("/:id", requireUser, async (req: AuthRequest, res) => {
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
  router.delete("/:id", requireUser, async (req: AuthRequest, res) => {
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
    requireUser,
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
          return res
            .status(400)
            .json({
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
