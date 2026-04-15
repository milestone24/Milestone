import { Router, Request, Response } from "express";
import multer from "multer";
import {
  AuthRequest,
  AuthService,
  requireTenantWithUserAccountId,
} from "server/auth";
import { parseQueryParamsExpress } from "@server/utils/resource-query-builder";
import {
  userAssetValueOrphanInsertSchema,
  assetContributionOrphanInsertSchema,
  userAssetInsertSchema,
  recurringContributionOrphanInsertSchema,
  recurringContributionBulkInsertSchema,
  securityTransactionOrphanInsertSchema,
  userAssetOrphanInsertSchema,
  userAssetSecurityOrphanCreateSchema,
  userAssetSecurityOrphanLinkInsertSchema,
  assetUpdateSchema,
} from "@shared/schema";
import { regExpPath, uuidRouteParam } from "@server/utils/uuid";
import { db } from "@server/db";
import { DatabaseAssetService } from "@server/services/assets/database";
import {
  NominatedUserAssetInvalidError,
  startDocumentOcr,
} from "@server/services/process/document-ocr";
import { runWithContext } from "@server/context/request-context";
import { and, eq } from "drizzle-orm";
import { userAssets } from "@server/db/schema";
import { listPendingOcrReviewsForAsset } from "@server/services/ocr/ocr-job-review-service";

const assetService = new DatabaseAssetService(db);
const documentExtractUpload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser, requireApiKey } = authService.getAuthMiddlewares();

  router.get("/", requireUser, async (req: Request, res) => {
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

  router.post("/", requireUser, async (req: Request, res) => {
    if (!req.tenant?.userAccountId) {
      return res.status(400).json({ error: "User account ID is required" });
    }

    try {
      const parsedData = userAssetOrphanInsertSchema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ error: parsedData.error.message });
      }

      const asset = await assetService.createUserAsset({
        ...parsedData.data,
        userAccountId: req.tenant.userAccountId,
      });
      res.json(asset);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  });

  router.post(
    regExpPath(
      `/${uuidRouteParam("assetId")}/documents/(?<platformKey>[^/]+)/extract`
    ),
    requireUser,
    documentExtractUpload.single("file"),
    async (req: AuthRequest, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "A file is required" });
      }
      const { assetId, platformKey } = req.params;
      if (!assetId || !platformKey) {
        return res.status(400).json({ error: "Asset ID and platform key are required" });
      }
      const platformNames: string[] = req.body.platformNames
        ? JSON.parse(req.body.platformNames as string)
        : [];
      try {
        const result = await runWithContext(
          { userAccountId: req.tenant!.userAccountId! },
          () => startDocumentOcr(req.file!, platformKey, platformNames, {
            nominatedUserAssetId: assetId,
          })
        );
        return res.status(202).json(result);
      } catch (err) {
        if (err instanceof NominatedUserAssetInvalidError) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }
    }
  );

  router.get(
    regExpPath(`/${uuidRouteParam("assetId")}/ocr-pending-review`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const assetId = req.params.assetId;
      if (!assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }

      const rows = await requireTenantWithUserAccountId(
        req.tenant,
        async (tenant) => {
          const owned = await db.query.userAssets.findFirst({
            where: and(
              eq(userAssets.id, assetId),
              eq(userAssets.userAccountId, tenant.userAccountId)
            ),
            columns: { id: true },
          });
          if (!owned) {
            return null;
          }
          return listPendingOcrReviewsForAsset({
            userAccountId: tenant.userAccountId,
            assetId,
          });
        }
      );

      if (rows === null) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json(rows);
    }
  );

  router.get(
    regExpPath(`/${uuidRouteParam("assetId")}`),
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const asset = await assetService.getUserAsset(req.params.assetId);
      res.json(asset);
    }
  );

  router.patch(
    regExpPath(`/${uuidRouteParam("assetId")}`),
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      //Make this partial
      const data = assetUpdateSchema.safeParse(req.body);
      if (!data.success) {
        return res.status(400).json({ error: data.error.message });
      }
      const asset = await assetService.updateUserAsset(req.params.assetId, data.data);
      res.json(asset);
    }
  );

  router.delete(
    regExpPath(`/${uuidRouteParam("assetId")}`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/history`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/history/graph`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/transactions/graph`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/history`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/history/update`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/securities`),
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const queryParams = parseQueryParamsExpress(req.query);
      const securities = await assetService.getResolvedUserAssetSecurities(
        req.params.assetId,
        queryParams
      );
      res.json(securities);
    }
  );

  router.post(
    regExpPath(`/${uuidRouteParam("assetId")}/securities`),
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const validation = userAssetSecurityOrphanCreateSchema.safeParse(
        req.body
      );
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }
      const data = validation.data;
      const security =
        await assetService.createUserAssetSecurityAndTriggerUpdates(
          req.params.assetId,
          data
        );
      res.json(security);
    }
  );

  // NOTE: This route appears currently unused on the client.
  // Returns UserAssetSecuritySelect — does NOT include calculatedValue.
  router.get(
    regExpPath(
      `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`
    ),
    requireUser,
    async (req: AuthRequest, res) => {
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
    }
  );

  router.put(
    regExpPath(
      `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`
    ),
    requireUser,
    async (req: AuthRequest, res) => {
      console.log("PUT req.params", JSON.stringify(req.params, null, 2));
      console.log("PUT req.body", JSON.stringify(req.body, null, 2));
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      const validation = userAssetSecurityOrphanLinkInsertSchema.safeParse(
        req.body
      );
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }
      const data = validation.data;
      const valueItem = await assetService.updateUserAssetSecurity(
        req.params.assetId,
        req.params.securityId,
        data
      );
      res.json(valueItem);
    }
  );

  router.delete(
    regExpPath(
      `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam("securityId")}`
    ),
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
    regExpPath(`/${uuidRouteParam("assetId")}/securities/transactions`),
    requireUser,
    async (req: AuthRequest, res) => {
      console.log("GET req.params", JSON.stringify(req.params, null, 2));

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
    regExpPath(
      `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam(
        "securityId"
      )}/transactions`
    ),
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

  router.delete(
    regExpPath(
      `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam(
        "securityId"
      )}/transactions/${uuidRouteParam("transactionId")}`
    ),
    requireUser,
    async (req: AuthRequest, res) => {
      console.log("DELETE req.params", JSON.stringify(req.params, null, 2));

      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      if (!req.params.transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
      }
      const result = await assetService.deleteUserAssetSecurityTransaction(
        req.params.assetId,
        req.params.securityId,
        req.params.transactionId
      );
      res.json({ success: result });
    }
  );

  router.put(
    regExpPath(
      `/${uuidRouteParam("assetId")}/securities/${uuidRouteParam(
        "securityId"
      )}/transactions/${uuidRouteParam("transactionId")}`
    ),
    requireUser,
    async (req: AuthRequest, res) => {
      console.log("PUT req.params", JSON.stringify(req.params, null, 2));

      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      if (!req.params.securityId) {
        return res.status(400).json({ error: "Security ID is required" });
      }
      if (!req.params.transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
      }

      const data = securityTransactionOrphanInsertSchema.safeParse(req.body);
      if (!data.success) {
        return res.status(400).json({ error: data.error.message });
      }

      const transaction = await assetService.updateUserAssetSecurityTransaction(
        req.params.assetId,
        req.params.securityId,
        req.params.transactionId,
        data.data
      );
      res.json(transaction);
    }
  );

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

  // Broker asset contributions (debits)
  router.post(
    regExpPath(`/${uuidRouteParam("assetId")}/contributions`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/contributions`),
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
    regExpPath(
      `/${uuidRouteParam("assetId")}/contributions/${uuidRouteParam(
        "contributionId"
      )}`
    ),
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
    regExpPath(
      `/${uuidRouteParam("assetId")}/contributions/${uuidRouteParam(
        "contributionId"
      )}`
    ),
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
    regExpPath(
      `/${uuidRouteParam("assetId")}/history/${uuidRouteParam("historyId")}`
    ),
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
    regExpPath(
      `/${uuidRouteParam("assetId")}/history/${uuidRouteParam("historyId")}`
    ),
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

  // // Broker Provider Asset Value Items (Individual Holdings) Routes
  // router.get(
  //   `/${uuidRouteParam("assetId")}/securities`,
  //   requireUser,
  //   async (req: AuthRequest, res) => {
  //     if (!req.params.assetId) {
  //       return res.status(400).json({ error: "Asset ID is required" });
  //     }
  //     const queryParams = parseQueryParamsExpress(req.query);
  //     const valueItems = await assetService.getUserAssetSecurities(
  //       req.params.assetId,
  //       queryParams
  //     );
  //     res.json(valueItems);
  //   }
  // );

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

  router.get("/portfolio-overview", requireUser, async (req: AuthRequest, res) => {
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

  router.get("/portfolio-value", requireUser, async (req: AuthRequest, res) => {
    const response = await requireTenantWithUserAccountId(
      req.tenant,
      async (tenant) => {
        const value = await assetService.getPortfolioValueForUser(
          tenant.userAccountId,
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
    regExpPath(`/${uuidRouteParam("assetId")}/recurring-contributions`),
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
    regExpPath(`/${uuidRouteParam("assetId")}/recurring-contributions`),
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

  // Bulk create recurring contributions distributed across multiple securities
  router.post(
    regExpPath(`/${uuidRouteParam("assetId")}/recurring-contributions/group`),
    requireUser,
    async (req: AuthRequest, res) => {
      if (!req.params.assetId) {
        return res.status(400).json({ error: "Asset ID is required" });
      }
      const data = recurringContributionBulkInsertSchema.parse(req.body);
      const recurringContributions =
        await assetService.createRecurringContributionGroup(
          req.params.assetId,
          data
        );
      res.json(recurringContributions);
    }
  );

  router.put(
    regExpPath(
      `/${uuidRouteParam("assetId")}/recurring-contributions/${uuidRouteParam(
        "contributionId"
      )}`
    ),
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
    regExpPath(
      `/${uuidRouteParam("assetId")}/recurring-contributions/${uuidRouteParam(
        "contributionId"
      )}`
    ),
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
    regExpPath(`/recurring-contributions/process`),
    requireApiKey,
    async (req: AuthRequest, res) => {
      const processCount = await assetService.processRecurringContributions();
      res.json({ processedCount: processCount });
    }
  );

  return router;
}
