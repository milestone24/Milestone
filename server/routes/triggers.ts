import { AuthService } from "@server/auth";
import { db } from "@server/db";
import { assetPersistenceFactory } from "@server/services/assets/database";
import { AssetValuesService } from "@server/services/process/asset-values";
import { Router } from "express";

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireApiKey } = authService.getAuthMiddlewares();

  const assetValuesService = new AssetValuesService(db);

  router.post(
    "/triggers/asset-values-update",
    requireApiKey,
    async (req, res) => {
      const { accountId, assetId } = req.body;
      assetValuesService.updateAssetValuesForAllAssetsOfAllAccounts();
      res.json({ message: "Asset values updated" });
    }
  );

  return router;
}
