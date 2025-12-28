import { AuthService } from "@server/auth";
import { db } from "@server/db";
import { AssetValuesService } from "@server/services/process/asset-values";
import { SecuritiesCacheService } from "@server/services/process/securities-cache";
import { Router } from "express";

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireApiKey, requireScope } = authService.getAuthMiddlewares();

  const assetValuesService = new AssetValuesService(db);
  const securitiesCacheService = new SecuritiesCacheService(db);

  router.post(
    "/asset-values-update",
    requireApiKey,
    requireScope("trigger"),
    async (req, res) => {
      console.log("Updating asset values for all assets of all accounts");
      assetValuesService.updateAssetValuesForAllAssetsOfAllAccounts();
      res.json({ message: "Asset values update has been triggered" });
    }
  );

  router.post(
    "/securities-daily-history-cache-update",
    requireApiKey,
    requireScope("trigger"),
    async (req, res) => {
      console.log("Updating securities daily history cache for all securities");
      securitiesCacheService.updateSecuritiesDailyHistoryCacheForAllSecurities();
      res.json({
        message: "Securities daily history cache update has been triggered",
      });
    }
  );

  return router;
}
