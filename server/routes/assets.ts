import { Router } from "express";
import {
  AuthRequest,
  AuthService,
  requireTenantWithUserAccountId,
} from "server/auth";
import { parseQueryParamsExpress } from "@server/utils/resource-query-builder";
import {
  assetValueInsertSchema,
  assetValueOrphanInsertSchema,
  assetContributionOrphanInsertSchema,
  brokerProviderAssetInsertSchema,
  generalAssetInsertSchema,
  recurringContributionOrphanInsertSchema,
} from "@shared/schema";
import { uuidRouteParam } from "@server/utils/uuid";
import asyncCatch from "./utils";
import { db } from "@server/db";
import { DatabaseAssetService } from "@server/services/assets/database";

const assetService = new DatabaseAssetService(db);

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser, requireApiKey } = authService.getAuthMiddlewares();

  router.get("/broker", requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        const queryParams = parseQueryParamsExpress(req.query);
        console.log("GET broker queryParams", queryParams);
        const assets =
          await assetService.getBrokerProviderAssetsWithAccountValueChangeForUser(
            tenant.userAccountId,
            queryParams
        );
        return assets;
      }
    );

    res.json(response);
  });

  router.post("/broker", requireUser, async (req: AuthRequest, res) => {
    try {
      const data = brokerProviderAssetInsertSchema.parse(req.body);
      const asset = await assetService.createBrokerProviderAsset(data);
      res.json(asset);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "An unknown error occurred" });
    }
  });

  router.get(
    `/broker/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.getBrokerProviderAsset(
        req.params.assetId
      );
      res.json(asset);
    }
  );

  router.put(
    `/broker/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = brokerProviderAssetInsertSchema.parse(req.body);
      const asset = await assetService.updateBrokerProviderAsset(
        req.params.assetId,
        data
      );
      res.json(asset);
    }
  );

  router.delete(
    `/broker/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.deleteBrokerProviderAsset(
        req.params.assetId
      );
      res.json(asset);
    }
  );

  router.get(
    `/broker/${uuidRouteParam("assetId")}/history`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const history = await assetService.getBrokerProviderAssetValueHistory(
        req.params.assetId,
        queryParams
      );
      res.json(history);
    }
  );

  router.post(
    `/broker/${uuidRouteParam("assetId")}/history`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = assetValueOrphanInsertSchema.parse(req.body);
      const history = await assetService.createBrokerProviderAssetValueHistory(
        req.params.assetId,
        data
      );
      res.json(history);
    }
  );
  
  // Broker asset contributions (debits)
  router.post(
    `/broker/${uuidRouteParam("assetId")}/contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = assetContributionOrphanInsertSchema.parse(req.body);
      const contribution = await assetService.createBrokerProviderAssetContributionHistory(
        req.params.assetId,
        data
      );
      res.json(contribution);
    }
  );
  
  router.get(
    `/broker/${uuidRouteParam("assetId")}/contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const contributions = await assetService.getBrokerProviderAssetContributionHistory(
        req.params.assetId,
        queryParams
      );
      res.json(contributions);  
    }
  );
  
  router.put(
    `/broker/${uuidRouteParam("assetId")}/contributions/${uuidRouteParam("contributionId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const data = assetContributionOrphanInsertSchema.parse(req.body);
      const contribution = await assetService.updateBrokerProviderAssetContributionHistory(
        req.params.assetId,
        req.params.contributionId,
        data
      );
      res.json(contribution);
    }
  );
  
  router.delete(
    `/broker/${uuidRouteParam("assetId")}/contributions/${uuidRouteParam("contributionId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const result = await assetService.deleteBrokerProviderAssetContributionHistory(
        req.params.assetId,
        req.params.contributionId
      );
      res.json({ success: result });
    }
  );

  router.put(
    `/broker/${uuidRouteParam("assetId")}/history/${uuidRouteParam(
      "historyId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.historyId) {
        return res.status(400).json({ error: "History ID is required" });
      }
      const data = assetValueOrphanInsertSchema.parse(req.body);
      const history = await assetService.updateBrokerProviderAssetValueHistory(
        req.params.assetId,
        req.params.historyId,
        data
      );
      res.json(history);
    }
  );

  router.delete(
    `/broker/${uuidRouteParam("assetId")}/history/${uuidRouteParam(
      "historyId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.historyId) {
        return res.status(400).json({ error: "History ID is required" });
      }
      const history = await assetService.deleteBrokerProviderAssetValueHistory(
        req.params.assetId,
        req.params.historyId
      );
      res.json(history);
    }
  );

  // Broker Provider Asset Value Items (Individual Holdings) Routes
  router.get(
    `/broker/${uuidRouteParam("assetId")}/securities`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const valueItems = await assetService.getBrokerProviderAssetSecurities(
        req.params.assetId,
        queryParams
      );
      res.json(valueItems);
    }
  );

  router.get(
    `/broker/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`,
    requireUser,
    asyncCatch(async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const valueItems = await assetService.getBrokerProviderAssetSecurity(
        req.params.assetId,
        req.params.securityId
      );
      res.json(valueItems);
    })
  );

  // router.post(
  //   `/broker/${uuidRouteParam("assetId")}/securities`,
  //   requireUser,
  //   async (req: AuthRequest, res) => {
  //     if(!req.params.assetId) {
  //       return res.status(400).json({ error: "Asset ID is required" });
  //     }
  //     const data = brokerProviderAssetSecurityInsertSchema.parse(req.body);
  //     const valueItem = await assetService.createBrokerProviderAssetSecurity(
  //       req.params.assetId,
  //       data
  //     );
  //     res.json(valueItem);
  //   }
  // );

  // router.put(
  //   `/broker/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`,
  //   requireUser,
  //   async (req: AuthRequest, res) => {
  //     if(!req.params.assetId) {
  //       return res.status(400).json({ error: "Asset ID is required" });
  //     }
  //     if(!req.params.securityId) {
  //       return res.status(400).json({ error: "Security ID is required" });
  //     }
  //     const data = brokerProviderAssetSecurityInsertSchema.parse(req.body);
  //     const valueItem = await assetService.updateBrokerProviderAssetSecurity(
  //       req.params.assetId,
  //       req.params.securityId,
  //       data
  //     );
  //     res.json(valueItem);
  //   }
  // );

  router.delete(
    `/broker/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const result = await assetService.deleteBrokerProviderAssetSecurity(
        req.params.assetId,
        req.params.securityId
      );
      res.json({ success: result });
    }
  );

  /**
   * General Assets
   */

  router.get("/general", requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        const queryParams = parseQueryParamsExpress(req.query);
        if (req.query.start || req.query.end) {
          // await assetService.getGeneralAssetsWithAccountChangeForUser(
          //   tenant.userAccountId,
          //   {
          //     ...query,
          //     start: req.query.start,
          //     end: req.query.end,
          //   }
          // );

          const assets =
            await assetService.getGeneralAssetsWithAccountChangeForUser(
              tenant.userAccountId,
              queryParams
            );
          return assets;
        } else {
          const assets = await assetService.getGeneralAssetsForUser(
            tenant.userAccountId,
            queryParams
          );
          return assets;
        }
      }
    );

    res.json(response);
  });

  router.post("/general", requireUser, async (req: AuthRequest, res) => {
    const data = generalAssetInsertSchema.parse(req.body);
    const asset = await assetService.createGeneralAsset(data);
    res.json(asset);
  });

  router.get(
    `/general/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.getGeneralAsset(req.params.assetId);
      res.json(asset);
    }
  );

  router.put(
    `/general/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = generalAssetInsertSchema.parse(req.body);
      const asset = await assetService.updateGeneralAsset(
        req.params.assetId,
        data
      );
      res.json(asset);
    }
  );

  router.delete(
    `/general/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.deleteGeneralAsset(req.params.assetId);
      res.json(asset);
    }
  );

  router.get(
    `/general/${uuidRouteParam("assetId")}/history`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const history = await assetService.getGeneralAssetHistory(
        req.params.assetId,
        queryParams
      );
      res.json(history);
    }
  );

  router.post(
    `/general/${uuidRouteParam("assetId")}/history`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = assetValueInsertSchema.parse(req.body);
      const history = await assetService.createGeneralAssetValueHistory(
        req.params.assetId,
        data
      );
      res.json(history);
    }
  );

  router.put(
    `/general/${uuidRouteParam("assetId")}/history/${uuidRouteParam(
      "historyId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.historyId) {
        return res.status(400).json({ error: "History ID is required" });
      }
      const data = assetValueInsertSchema.parse(req.body);
      const history = await assetService.updateGeneralAssetValueHistory(
        req.params.assetId,
        req.params.historyId,
        data
      );
      res.json(history);
    }
  );

  router.delete(
    `/general/${uuidRouteParam("assetId")}/history/${uuidRouteParam(
      "historyId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.historyId) {
        return res.status(400).json({ error: "History ID is required" });
      }
      const history = await assetService.deleteGeneralAssetValueHistory(
        req.params.assetId,
        req.params.historyId
      );
      res.json(history);
    }
  );

  router.get(
    "/broker-providers",
    requireUser,
    async (req: AuthRequest, res) => {
      const providers = await assetService.getBrokerAssetProviders();
      res.json(providers);
    }
  );

  router.get("/portfolio-value", requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
          const value = await assetService.getPortfolioOverviewForUserForDateRange(
            tenant.userAccountId,
            {
              start: req.query?.start ? new Date(req.query.start as string) : null,
              end: req.query?.end ? new Date(req.query.end as string) : null,
            }
          );
        return value;
      }
    );

    res.json(response);
  });

  router.get(
    "/portfolio-value/history",
    requireUser,
    async (req: AuthRequest, res) => {
      const response = await requireTenantWithUserAccountId(
        req.tenant,
        async (tenant) => {
          const history =
            await assetService.getPortfolioValueHistoryForUserForDateRange(
              tenant.userAccountId,
              {
                start: req.query?.start ? new Date(req.query.start as string) : null,
                end: req.query?.end ? new Date(req.query.end as string) : null,
              }
            );
          return history;
        }
      );
      res.json(response);
    }
  );

  // Recurring Contributions Routes
  router.get(
    `/broker/${uuidRouteParam("assetId")}/recurring-contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const recurringContributions = await assetService.getRecurringContributionsForAsset(
        req.params.assetId,
        queryParams
      );
      res.json(recurringContributions);
    }
  );

  router.post(
    `/broker/${uuidRouteParam("assetId")}/recurring-contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = recurringContributionOrphanInsertSchema.parse(req.body);
      const recurringContribution = await assetService.createRecurringContribution(
        req.params.assetId,
        data
      );
      res.json(recurringContribution);
    }
  );

  router.put(
    `/broker/${uuidRouteParam("assetId")}/recurring-contributions/${uuidRouteParam("contributionId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const data = recurringContributionOrphanInsertSchema.parse(req.body);
      const recurringContribution = await assetService.updateRecurringContribution(
        req.params.assetId,
        req.params.contributionId,
        data
      );
      res.json(recurringContribution);
    }
  );

  router.delete(
    `/broker/${uuidRouteParam("assetId")}/recurring-contributions/${uuidRouteParam("contributionId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if(!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if(!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const result = await assetService.deleteRecurringContribution(
        req.params.assetId,
        req.params.contributionId
      );
      res.json({ success: result });
    }
  );

  // Add a route to manually trigger processing of recurring contributions (for admin/testing)
  router.post(
    `/recurring-contributions/process`,
    requireApiKey,
    async (req: AuthRequest, res) => {
      const processCount = await assetService.processRecurringContributions();
      res.json({ processedCount: processCount });
    }
  );

  return router;
}
