import { Router } from "express";
import {
  AuthRequest,
  AuthService,
  requireTenantWithUserAccountId,
} from "server/auth";
import { parseQueryParamsExpress } from "@server/utils/resource-query-builder";
import {
  userAssetValueInsertSchema,
  userAssetValueOrphanInsertSchema,
  assetContributionOrphanInsertSchema,
  userAssetInsertSchema,
  recurringContributionOrphanInsertSchema,
  securityTransactionOrphanInsertSchema,
} from "@shared/schema";
import { uuidRouteParam } from "@server/utils/uuid";
import asyncCatch from "./utils";
import { db } from "@server/db";
import {
  assetPersistenceFactory,
  DatabaseAssetService,
} from "@server/services/assets/database";

const assetService = new DatabaseAssetService(db);

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser, requireApiKey } = authService.getAuthMiddlewares();

  router.get("/", requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        const queryParams = parseQueryParamsExpress(req.query);
        const assets = await assetService.getUserAssetsWithAccountValueChange(
          tenant.userAccountId,
          queryParams
        );
        /**
         * This is a temporray fix to make sure the current value
         * is from live data and not the DB value until DB functions or procedures
         * may be implementd or long term way to always use calculated value.
         */
        const modifiedAssets = assets.map((asset) => ({
          ...asset,
          currentValue: asset.accountChange.value,
        }));

        return modifiedAssets;
      }
    );

    res.json(response);
  });

  router.post("/", requireUser, async (req: AuthRequest, res) => {
    try {
      const data = userAssetInsertSchema.parse(req.body);
      const asset = await assetService.createUserAsset(data);
      res.json(asset);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  });

  router.get(
    `/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.getUserAsset(req.params.assetId);
      res.json(asset);
    }
  );

  router.put(
    `/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = userAssetInsertSchema.parse(req.body);
      const asset = await assetService.updateUserAsset(
        req.params.assetId,
        data
      );
      res.json(asset);
    }
  );

  router.delete(
    `/${uuidRouteParam("assetId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.deleteUserAsset(req.params.assetId);
      res.json(asset);
    }
  );

  router.get(
    `/${uuidRouteParam("assetId")}/history`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const history = await assetService.getUserAssetValueHistory(
        req.params.assetId,
        queryParams
      );
      res.json(history);
    }
  );

  router.get(
    `/${uuidRouteParam("assetId")}/history/graph`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const history = await assetService.getUserAssetValueHistoryGraph(
        req.params.assetId,
        {
          start: req.query?.start ? new Date(req.query.start as string) : null,
          end: req.query?.end ? new Date(req.query.end as string) : null,
        }
      );
      res.json(history);
    }
  );

  router.get(
    `/${uuidRouteParam("assetId")}/transactions/graph`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }

      const query = parseQueryParamsExpress(req.query);

      const history = await assetService.getUserAssetTransactionHistoryGraph(
        req.params.assetId,
        query
      );
      res.json(history);
    }
  );

  router.post(
    `/${uuidRouteParam("assetId")}/history`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = userAssetValueOrphanInsertSchema.parse(req.body);
      const history = await assetService.createUserAssetValueHistory(
        req.params.assetId,
        data
      );
      res.json(history);
    }
  );

  router.put(
    `/${uuidRouteParam("assetId")}/history/update`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }

      await assetService.updateUserAssetHistories(req.params.assetId);

      res.json({ success: true });
    }
  );

  router.get(
    `/${uuidRouteParam("assetId")}/securities/transactions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }

      const transactions =
        await assetService.getUserAssetSecurityTransactionHistory(
          req.params.assetId
        );
      res.json(transactions);
    }
  );

  router.post(
    `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam(
      "securityId"
    )}/transactions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const data = securityTransactionOrphanInsertSchema.parse(req.body);
      const transaction = await assetService.createUserAssetSecurityTransaction(
        req.params.securityId,
        data
      );
      res.json(transaction);
    }
  );

  // Broker asset contributions (debits)
  router.post(
    `/${uuidRouteParam("assetId")}/contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = assetContributionOrphanInsertSchema.parse(req.body);
      const contribution = await assetService.createUserAssetTransaction(
        req.params.assetId,
        data
      );
      res.json(contribution);
    }
  );

  router.get(
    `/${uuidRouteParam("assetId")}/contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);

      const contributions = await assetService.getUserAssetTransactions(
        req.params.assetId,
        queryParams
      );
      res.json(contributions);
    }
  );

  router.put(
    `/${uuidRouteParam("assetId")}/contributions/${uuidRouteParam(
      "contributionId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const data = assetContributionOrphanInsertSchema.parse(req.body);
      const contribution = await assetService.updateUserAssetTransaction(
        req.params.assetId,
        req.params.contributionId,
        data
      );
      res.json(contribution);
    }
  );

  router.delete(
    `/${uuidRouteParam("assetId")}/contributions/${uuidRouteParam(
      "contributionId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const result = await assetService.deleteUserAssetTransaction(
        req.params.assetId,
        req.params.contributionId
      );
      res.json({ success: result });
    }
  );

  router.put(
    `/${uuidRouteParam("assetId")}/history/${uuidRouteParam("historyId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.historyId) {
        return res.status(400).json({ error: "History ID is required" });
      }
      const data = userAssetValueOrphanInsertSchema.parse(req.body);
      const history = await assetService.updateUserAssetValueHistory(
        req.params.assetId,
        req.params.historyId,
        data
      );
      res.json(history);
    }
  );

  router.delete(
    `/${uuidRouteParam("assetId")}/history/${uuidRouteParam("historyId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.historyId) {
        return res.status(400).json({ error: "History ID is required" });
      }
      const history = await assetService.deleteUserAssetValueHistory(
        req.params.assetId,
        req.params.historyId
      );
      res.json(history);
    }
  );

  // Broker Provider Asset Value Items (Individual Holdings) Routes
  router.get(
    `/${uuidRouteParam("assetId")}/securities`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const valueItems = await assetService.getUserAssetSecurities(
        req.params.assetId,
        queryParams
      );
      res.json(valueItems);
    }
  );

  router.get(
    `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`,
    requireUser,
    asyncCatch(async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const valueItems = await assetService.getUserAssetSecurity(
        req.params.assetId,
        req.params.securityId
      );
      res.json(valueItems);
    })
  );

  // router.post(
  //   `/${uuidRouteParam("assetId")}/securities`,
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
  //   `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`,
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
    `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const result = await assetService.deleteUserAssetSecurity(
        req.params.assetId,
        req.params.securityId
      );
      res.json({ success: result });
    }
  );

  router.get(
    "/broker-platforms",
    requireUser,
    async (req: AuthRequest, res) => {
      const platforms = await assetService.getBrokerPlatforms();
      res.json(platforms);
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
        const query = parseQueryParamsExpress(req.query);
        const value = await assetService.getPortfolioOverviewForUser(
          tenant.userAccountId,
          query
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
          const query = parseQueryParamsExpress(req.query);

          const history = await assetService.getPortfolioValueHistoryForUser(
            tenant.userAccountId,
            query
          );
          return history;
        }
      );

      console.log("response :", JSON.stringify(response.length, null, 2));

      res.json(response);
    }
  );

  router.get(
    "/portfolio-value/transactions",
    requireUser,
    async (req: AuthRequest, res) => {
      const response = await requireTenantWithUserAccountId(
        req.tenant,
        async (tenant) => {
          const query = parseQueryParamsExpress(req.query);

          const history =
            await assetService.getPortfolioTransactionHistoryForUser(
              tenant.userAccountId,
              query
            );
          return history;
        }
      );

      res.json(response);
    }
  );

  // Recurring Contributions Routes
  router.get(
    `/${uuidRouteParam("assetId")}/recurring-contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const recurringContributions =
        await assetService.getRecurringContributionsForAsset(
          req.params.assetId,
          queryParams
        );
      res.json(recurringContributions);
    }
  );

  router.post(
    `/${uuidRouteParam("assetId")}/recurring-contributions`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = recurringContributionOrphanInsertSchema.parse(req.body);
      const recurringContribution =
        await assetService.createRecurringContribution(
          req.params.assetId,
          data
        );
      res.json(recurringContribution);
    }
  );

  router.put(
    `/${uuidRouteParam("assetId")}/recurring-contributions/${uuidRouteParam(
      "contributionId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.contributionId) {
        return res.status(400).json({ error: "Contribution ID is required" });
      }
      const data = recurringContributionOrphanInsertSchema.parse(req.body);
      const recurringContribution =
        await assetService.updateRecurringContribution(
          req.params.assetId,
          req.params.contributionId,
          data
        );
      res.json(recurringContribution);
    }
  );

  router.delete(
    `/${uuidRouteParam("assetId")}/recurring-contributions/${uuidRouteParam(
      "contributionId"
    )}`,
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.contributionId) {
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
