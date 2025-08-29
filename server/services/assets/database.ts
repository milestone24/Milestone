import {
  assetValues,
  userAssets,
  brokerProviders,
  recurringContributions,
  securities,
  userAssetAPIKeyConnections,
  assetTransactions,
  userAssetSecurities,
} from "server/db/schema";
import { Database } from "../../db";
import { and, between, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  UserAsset,
  AssetContribution,
  assetContributionInsertSchema,
  AccountType,
  AssetValue,
  userAssetValueInsertSchema,
  BrokerProvider,
  PortfolioHistoryTimePoint,
  UserAccount,
  AssetsChange,
  UserAssetValueOrphanInsert,
  RecurringContribution,
  RecurringContributionOrphanInsert,
  ContributionInterval,
  WithAssetHistory,
  SecuritySelect,
  SecurityInsert,
  DataRangeQuery,
  UserAssetSecuritySelect,
  UserAssetSecurityInsert,
  SecuritySearchResult,
  AssetWithHistory,
  WithResolvedSecurities,
  ResolvedSecurity,
  BrokerPlatform,
  UserAssetWithAccountChange,
  UserAssetInsert,
  UserAssetTransactionOrphanInsert,
  AssetTransaction,
  ResolvedUserAsset,
} from "@shared/schema";
import { NodePgTransaction } from "drizzle-orm/node-postgres";
import { Schema, TSchema } from "server/db/types/utils";
import {
  QueryParams,
  QueryParts,
  ResourceQueryBuilder,
} from "@server/utils/resource-query-builder";
import {
  resolveAssetsWithChange,
  resolveAssetWithChangeForDateRange,
  resolveDate,
  getPortfolioOverviewForAssets,
  getPortfolioValueHistoryForAssets,
} from "@shared/utils/assets";

import { factory as securitiesFactory } from "@server/services/securities";
import { AssetSecurity } from "../securities/types";

const securitiesService = securitiesFactory();

type Transaction = NodePgTransaction<Schema, TSchema>;

const userAssetsQueryBuilder = new ResourceQueryBuilder({
  table: userAssets,
  allowedSortFields: [
    "createdAt",
    "updatedAt",
    "name",
    "providerId",
    "accountType",
  ],
  allowedFilterFields: ["providerId", "accountType"],
  defaultSort: { field: "createdAt", direction: "desc" },
  maxLimit: 50,
});

const assetValuesQueryBuilder = new ResourceQueryBuilder({
  table: assetValues,
  allowedSortFields: ["recordedAt"],
  allowedFilterFields: [],
  defaultSort: { field: "recordedAt", direction: "desc" },
  maxLimit: 50,
});

const userAssetSecuritiesQueryBuilder = new ResourceQueryBuilder({
  table: userAssetSecurities,
  allowedSortFields: ["recordedAt"],
  allowedFilterFields: [],
  defaultSort: { field: "recordedAt", direction: "desc" },
  maxLimit: 50,
});

const assetTransactionsQueryBuilder = new ResourceQueryBuilder({
  table: assetTransactions,
  allowedSortFields: ["recordedAt"],
  allowedFilterFields: [],
  defaultSort: { field: "recordedAt", direction: "desc" },
  maxLimit: 50,
});

const recurringContributionsQueryBuilder = new ResourceQueryBuilder({
  table: recurringContributions,
  allowedSortFields: [
    "createdAt",
    "updatedAt",
    "amount",
    "startDate",
    "lastProcessedDate",
    "interval",
    "isActive",
  ],
  allowedFilterFields: ["interval", "isActive"],
  defaultSort: { field: "createdAt", direction: "desc" },
  maxLimit: 50,
});

export class DatabaseAssetService {
  constructor(private db: Database) {}

  private async recalculateAssetValue(
    tx: Transaction,
    assetId: UserAsset["id"]
  ): Promise<void> {
    // Get the most recent history entry for the account
    const latestHistory = await tx.query.assetValues.findFirst({
      where: eq(assetValues.assetId, assetId),
      orderBy: (assetValues, { desc }) => [desc(assetValues.recordedAt)],
    });

    if (latestHistory) {
      // Update the account's current value with the latest history value
      await tx
        .update(userAssets)
        .set({ currentValue: latestHistory.value })
        .where(eq(userAssets.id, assetId));
    }
  }

  private async withValueTransaction<T>(
    operation: (tx: Transaction) => Promise<T>,
    assetId: UserAsset["id"]
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const result = await operation(tx);
      await this.recalculateAssetValue(tx, assetId);
      return result;
    });
  }

  async getUserAssets(
    userId: UserAccount["id"],
    query: QueryParams
  ): Promise<UserAsset[]> {
    const { where, orderBy, limit, offset } =
      userAssetsQueryBuilder.buildQuery(query);
    const brokerAssets = await this.db.query.userAssets.findMany({
      with: { provider: true, securities: { with: { security: true } } },
      where: and(eq(userAssets.userAccountId, userId), where),
      orderBy,
      limit,
      offset,
    });
    return brokerAssets;
  }

  async getUserAssetsWithAccountValueChange(
    userId: UserAccount["id"],
    query: QueryParams
  ): Promise<UserAssetWithAccountChange[]> {
    console.log("getBrokerProviderAssetsWithAccountChangeForUser", query);
    const brokerAssets = await this.getUserAssets(userId, query);
    const assetsWithHistory = await Promise.all(
      brokerAssets.map(async (asset) => {
        const assetValues =
          await this.getPortfolioAssetValuesForAssetsForDateRange([asset.id]);
        return { ...asset, history: assetValues };
      })
    );
    return resolveAssetsWithChange(assetsWithHistory);
  }

  async getUserAsset(id: UserAsset["id"]): Promise<ResolvedUserAsset> {
    const userAsset = await this.db.query.userAssets.findFirst({
      with: {
        platform: true,
        securities: { with: { security: true } },
      },
      where: eq(userAssets.id, id),
    });
    if (!userAsset) {
      throw new Error("User asset not found");
    }

    console.log("userAsset", userAsset.platform);
    //return brokerProviderAsset;
    return {
      ...userAsset,
      platform: userAsset.platform ?? undefined,
      securities: userAsset.securities.map((security) => ({
        ...security,
        calculatedValue: {
          value: 0,
          currentChange: 0,
          currentChangePercentage: 0,
        },
      })),
    };
  }

  async getUserAssetWithValueHistory(
    id: UserAsset["id"]
  ): Promise<WithAssetHistory<UserAsset>> {
    const userAssetWithHistory = await this.db.transaction(async (tx) => {
      const userAsset = await tx.query.userAssets.findFirst({
        where: eq(userAssets.id, id),
      });
      if (!userAsset) {
        throw new Error("User asset not found");
      }
      const assetValues =
        await this.getPortfolioAssetValuesForAssetsForDateRange([userAsset.id]);
      return { ...userAsset, history: assetValues };
    });
    return userAssetWithHistory;
  }

  async getUserAssetWithAccountValueChangeForUser(
    id: UserAsset["id"]
  ): Promise<UserAssetWithAccountChange> {
    const userAsset = await this.db.query.userAssets.findFirst({
      with: { provider: true },
      where: eq(userAssets.id, id),
    });
    if (!userAsset) {
      throw new Error("User asset not found");
    }
    const userAssetHistory = await this.db.query.assetValues.findMany({
      where: eq(assetValues.assetId, id),
    });

    return resolveAssetWithChangeForDateRange({
      ...userAsset,
      history: userAssetHistory,
    });
    //return { ...brokerAsset, accountChange: resolveAssetWithChange(brokerAsset, { start: query.start, end: query.end }) };
  }

  async getUserAssetValueHistory(
    id: UserAsset["id"],
    query: QueryParams
  ): Promise<AssetValue[]> {
    const { where, orderBy, limit, offset } =
      assetValuesQueryBuilder.buildQuery(query);
    console.log("getUserAssetValueHistory orderBy", orderBy);
    return this.db.query.assetValues.findMany({
      where: and(eq(assetValues.assetId, id), where),
      orderBy,
      limit,
      offset,
    });
  }

  async getUserAssetTransactions(
    id: UserAsset["id"],
    query: QueryParams
  ): Promise<AssetContribution[]> {
    const { where, orderBy, limit, offset } =
      assetTransactionsQueryBuilder.buildQuery(query);
    return this.db.query.assetTransactions.findMany({
      where: and(eq(assetTransactions.assetId, id), where),
      orderBy,
      limit,
      offset,
    });
  }

  async createUserAsset(data: UserAssetInsert): Promise<UserAsset> {
    const insertedUserAsset = await this.db.transaction(async (tx) => {
      const [insertedUserAsset] = await tx
        .insert(userAssets)
        .values({
          ...data,
          currentValue: data.currentValue ?? 0,
        })
        .returning();

      if (!insertedUserAsset) {
        throw new Error("Failed to create user asset");
      }

      const securities = data.securities.map((security) => ({
        ...security,
        assetId: insertedUserAsset.id,
      }));

      const securitiesToInsert = await Promise.all(
        securities.map(async (security) => {
          const persistedSecurity =
            await securitiesService.createOrFindCachedSecurity(
              security.security
            );
          return {
            securityId: persistedSecurity.id,
            userAssetId: insertedUserAsset.id,
            recordedAt: security.recordedAt ?? new Date(),
            shareHolding: security.shareHolding,
            gainLoss: security.gainLoss,
            startDate: security.startDate,
          };
        })
      );

      if (securitiesToInsert.length > 0) {
        await tx.insert(userAssetSecurities).values(securitiesToInsert);
      }

      if (data.valueMethod === "manual") {
        await tx.insert(assetValues).values({
          assetId: insertedUserAsset.id,
          value: data.currentValue ?? 0,
          valueDate: data.startDate,
          recordedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return insertedUserAsset;
    });

    const assetPersistence = assetPersistenceFactory(
      this,
      insertedUserAsset.id
    );

    await securitiesService.updateAssetValues(assetPersistence);

    return insertedUserAsset;
  }

  async updateUserAsset(
    id: UserAsset["id"],
    data: UserAssetInsert
  ): Promise<UserAsset> {
    const [updatedUserAsset] = await this.db
      .update(userAssets)
      .set(data)
      .where(eq(userAssets.id, id))
      .returning();

    if (!updatedUserAsset) {
      throw new Error("Failed to update user asset");
    }

    return updatedUserAsset;
  }

  async deleteUserAsset(id: UserAsset["id"]): Promise<boolean> {
    const result = await this.db.transaction(async (tx) => {
      await tx
        .delete(userAssetSecurities)
        .where(eq(userAssetSecurities.userAssetId, id));
      await tx
        .delete(userAssetAPIKeyConnections)
        .where(eq(userAssetAPIKeyConnections.userAssetId, id));
      await tx.delete(assetValues).where(eq(assetValues.assetId, id));
      await tx
        .delete(assetTransactions)
        .where(eq(assetTransactions.assetId, id));
      return tx.delete(userAssets).where(eq(userAssets.id, id));
    });
    return (result?.rowCount ?? 0) > 0;
  }

  async updateUserAssetHistories(id: UserAsset["id"]): Promise<UserAsset> {
    const assetPersistence = assetPersistenceFactory(this, id);
    await securitiesService.updateAssetValues(assetPersistence);
    return this.getUserAsset(id);
  }

  async getUserAssetsValueHistoryForUser(
    userId: UserAccount["id"],
    query: QueryParams
  ): Promise<UserAsset[]> {
    const { where, orderBy, limit, offset } =
      userAssetsQueryBuilder.buildQuery(query);
    return this.db.query.userAssets.findMany({
      with: { provider: true },
      where: and(eq(userAssets.userAccountId, userId), where),
      orderBy,
      limit,
      offset,
    });
  }

  async createUserAssetValueHistory(
    id: UserAsset["id"],
    data: UserAssetValueOrphanInsert
  ): Promise<AssetValue | undefined> {
    return this.withValueTransaction(async (tx: Transaction) => {
      const [insertedAssetValue] = await tx
        .insert(assetValues)
        .values({
          ...data,
          assetId: id,
        })
        .returning();
      return insertedAssetValue;
    }, id);
  }

  async pushAssetValuesForAsset(
    assetId: UserAsset["id"],
    values: UserAssetValueOrphanInsert[]
  ): Promise<AssetValue[]> {
    const insertedValues = await this.db
      .insert(assetValues)
      .values(
        values.map((value) => ({
          ...value,
          assetId,
        }))
      )
      .returning();

    if (!insertedValues) {
      throw new Error("Failed to create asset value history");
    }

    return insertedValues;
  }

  async updateUserAssetValueHistory(
    id: UserAsset["id"],
    assetValueId: AssetValue["id"],
    data: UserAssetValueOrphanInsert
  ): Promise<AssetValue> {
    const [updatedAssetValue] = await this.db
      .update(assetValues)
      .set(data)
      .where(and(eq(assetValues.assetId, id), eq(assetValues.id, assetValueId)))
      .returning();

    if (!updatedAssetValue) {
      throw new Error("Failed to update user asset value history");
    }

    return updatedAssetValue;
  }

  async deleteUserAssetValueHistory(
    id: UserAsset["id"],
    assetValueId: AssetValue["id"]
  ): Promise<boolean> {
    const result = await this.db
      .delete(assetValues)
      .where(
        and(eq(assetValues.assetId, id), eq(assetValues.id, assetValueId))
      );
    return (result?.rowCount ?? 0) > 0;
  }

  // async createUserAssetContributionHistory(
  //   id: UserAsset["id"],
  //   data: UserAssetTransactionOrphanInsert
  // ): Promise<AssetTransaction> {
  //   const [insertedAssetContribution] = await this.db
  //     .insert(assetTransactions)
  //     .values({
  //       ...data,
  //       assetId: id,
  //     })
  //     .returning();
  //   return insertedAssetContribution;
  // }

  /* Transactions */

  async createUserAssetTransaction(
    id: UserAsset["id"],
    data: UserAssetTransactionOrphanInsert
  ): Promise<AssetTransaction> {
    const [insertedAssetTransaction] = await this.db
      .insert(assetTransactions)
      .values({
        ...data,
        assetId: id,
        recordedAt: data.recordedAt ?? new Date(),
      })
      .returning();

    if (!insertedAssetTransaction) {
      throw new Error("Failed to create user asset transaction");
    }

    return insertedAssetTransaction;
  }

  async updateUserAssetTransaction(
    id: UserAsset["id"],
    assetTransactionId: AssetTransaction["id"],
    data: UserAssetTransactionOrphanInsert
  ): Promise<AssetTransaction> {
    const [updatedAssetTransaction] = await this.db
      .update(assetTransactions)
      .set(data)
      .where(
        and(
          eq(assetTransactions.assetId, id),
          eq(assetTransactions.id, assetTransactionId)
        )
      )
      .returning();

    if (!updatedAssetTransaction) {
      throw new Error("Failed to update user asset transaction");
    }

    return updatedAssetTransaction;
  }

  async deleteUserAssetTransaction(
    id: UserAsset["id"],
    assetTransactionId: AssetTransaction["id"]
  ): Promise<boolean> {
    const result = await this.db
      .delete(assetTransactions)
      .where(
        and(
          eq(assetTransactions.assetId, id),
          eq(assetTransactions.id, assetTransactionId)
        )
      );
    return (result?.rowCount ?? 0) > 0;
  }

  // async setBrokerProviderAPIKey(
  //   id: BrokerProviderAsset["id"],
  //   apiKey: string
  // ): Promise<BrokerProviderAssetAPIKeyConnection> {
  //   const existingBrokerProviderAsset = await this.getBrokerProviderAsset(id);
  //   if (!existingBrokerProviderAsset) {
  //     throw new Error("Broker provider asset not found");
  //   }

  //   const provider = await this.db.query.brokerProviders.findFirst({
  //     where: eq(brokerProviders.id, existingBrokerProviderAsset.providerId),
  //   });

  //   if (!provider) {
  //     throw new Error("Broker provider not found");
  //   }

  //   if (!provider.supportsAPIKey) {
  //     throw new Error("Broker provider does not support API keys");
  //   }

  //   const existingAPIKeyConnection =
  //     await this.db.query.brokerProviderAssetAPIKeyConnections.findFirst({
  //       where: eq(
  //         brokerProviderAssetAPIKeyConnections.brokerProviderAssetId,
  //         id
  //       ),
  //     });

  //   if (existingAPIKeyConnection) {
  //     const [updatedAPIKeyConnection] = await this.db
  //       .update(brokerProviderAssetAPIKeyConnections)
  //       .set({ apiKey })
  //       .where(
  //         eq(
  //           brokerProviderAssetAPIKeyConnections.id,
  //           existingAPIKeyConnection.id
  //         )
  //       )
  //       .returning();
  //     return updatedAPIKeyConnection;
  //   } else {
  //     const [insertedAPIKeyConnection] = await this.db
  //       .insert(brokerProviderAssetAPIKeyConnections)
  //       .values({ brokerProviderAssetId: id, apiKey })
  //       .returning();
  //     return insertedAPIKeyConnection;
  //   }
  // }

  /**
   * @deprecated This is no longer in use
   */
  // private async getCombinedAssetsForUser(
  //   userAccountId: UserAccount["id"]
  // ): Promise<UserAsset[]> {
  //   throw new Error("This is no longer in use");
  // const brokerProviderQuery: QueryParts = {
  //   where: and(eq(brokerProviderAssets.userAccountId, userAccountId)),
  //   orderBy: [desc(brokerProviderAssets.createdAt)],
  // };

  // const brokerProviderAssetsSelected =
  //   await this.getBrokerProviderAssetsForUser(
  //     userAccountId,
  //     brokerProviderQuery
  //   );

  // const generalQuery: QueryParts = {
  //   where: eq(generalAssets.userAccountId, userAccountId),
  //   orderBy: [desc(generalAssets.createdAt)],
  // };

  // const generalAssetsSelected = await this.getGeneralAssetsForUser(
  //   userAccountId,
  //   generalQuery
  // );

  // const assets: Asset[] = [
  //   ...brokerProviderAssetsSelected,
  //   ...generalAssetsSelected,
  // ];

  // return assets;
  //}

  private async getPortfolioAssetValuesForAssetsForDateRange(
    assetIds: UserAsset["id"][],
    query?: DataRangeQuery
  ): Promise<AssetValue[]> {
    const startDate = resolveDate(query?.start);
    const endDate = resolveDate(query?.end);

    const dateQueries =
      startDate && endDate
        ? [between(assetValues.recordedAt, startDate, endDate)]
        : startDate
        ? [gte(assetValues.recordedAt, startDate)]
        : endDate
        ? [lte(assetValues.recordedAt, endDate)]
        : [];

    const assetValuesQuery: QueryParts = {
      where: and(inArray(assetValues.assetId, assetIds), ...dateQueries),
      orderBy: [desc(assetValues.recordedAt)],
    };

    const { where, orderBy, limit, offset } = assetValuesQuery;

    const assetValuesToCalculate = await this.db.query.assetValues.findMany({
      where,
      orderBy,
      limit,
      offset,
    });

    return assetValuesToCalculate;
  }

  async getPortfolioOverviewForUserForDateRange(
    userAccountId: UserAccount["id"],
    query?: DataRangeQuery
  ): Promise<AssetsChange> {
    const assetsToCalculate = await this.getUserAssets(userAccountId, {});

    // const assetsToCalculateBefore = await this.getCombinedAssetsForUser(
    //   userAccountId
    // );

    const assetsWithHistory = await Promise.all(
      assetsToCalculate.map(async (asset) => {
        const assetValues =
          await this.getPortfolioAssetValuesForAssetsForDateRange(
            [asset.id],
            query
          );
        return { ...asset, history: assetValues };
      })
    );

    return getPortfolioOverviewForAssets(
      assetsWithHistory /*Need to add query */
    );
  }

  async getPortfolioValueHistoryForUserForDateRange(
    userAccountId: UserAccount["id"],
    query?: DataRangeQuery
  ): Promise<PortfolioHistoryTimePoint[]> {
    const assetsToCalculate = await this.getUserAssets(userAccountId, {});

    // const assetsToCalculateBefore = await this.getCombinedAssetsForUser(
    //   userAccountId
    // );

    const assetsWithHistory = await Promise.all(
      assetsToCalculate.map(async (asset): Promise<AssetWithHistory> => {
        const assetValues =
          await this.getPortfolioAssetValuesForAssetsForDateRange(
            [asset.id],
            query
          );
        return {
          ...asset,
          history: assetValues.sort(
            (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
          ),
        };
        ``;
      })
    );

    return getPortfolioValueHistoryForAssets(assetsWithHistory, query);
  }

  async getBrokerPlatforms(): Promise<BrokerPlatform[]> {
    return this.db.query.brokerPlatforms.findMany();
  }

  async getBrokerAssetProviders(): Promise<BrokerProvider[]> {
    return this.db.query.brokerProviders.findMany();
  }

  /**
   * Recurring Contributions
   */

  async getRecurringContributionsForAsset(
    assetId: UserAsset["id"],
    query: QueryParams
  ): Promise<RecurringContribution[]> {
    const { where, orderBy, limit, offset } =
      recurringContributionsQueryBuilder.buildQuery(query);
    return this.db.query.recurringContributions.findMany({
      where: and(eq(recurringContributions.assetId, assetId), where),
      orderBy,
      limit,
      offset,
    });
  }

  async createRecurringContribution(
    assetId: UserAsset["id"],
    data: RecurringContributionOrphanInsert
  ): Promise<RecurringContribution> {
    // Make sure the asset exists
    const asset = await this.getUserAsset(assetId);
    if (!asset) {
      throw new Error(`Asset with ID ${assetId} not found`);
    }

    const [insertedRecurringContribution] = await this.db
      .insert(recurringContributions)
      .values({
        ...data,
        assetId,
      })
      .returning();

    if (!insertedRecurringContribution) {
      throw new Error("Failed to create recurring contribution");
    }

    return insertedRecurringContribution;
  }

  async updateRecurringContribution(
    assetId: UserAsset["id"],
    contributionId: RecurringContribution["id"],
    data: RecurringContributionOrphanInsert
  ): Promise<RecurringContribution> {
    // Make sure the contribution exists and belongs to the asset
    const existingContribution =
      await this.db.query.recurringContributions.findFirst({
        where: and(
          eq(recurringContributions.id, contributionId),
          eq(recurringContributions.assetId, assetId)
        ),
      });

    if (!existingContribution) {
      throw new Error(
        `Recurring contribution with ID ${contributionId} not found for asset ${assetId}`
      );
    }

    const [updatedContribution] = await this.db
      .update(recurringContributions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(recurringContributions.id, contributionId))
      .returning();

    if (!updatedContribution) {
      throw new Error("Failed to update recurring contribution");
    }

    return updatedContribution;
  }

  async deleteRecurringContribution(
    assetId: UserAsset["id"],
    contributionId: RecurringContribution["id"]
  ): Promise<boolean> {
    // Make sure the contribution exists and belongs to the asset
    const existingContribution =
      await this.db.query.recurringContributions.findFirst({
        where: and(
          eq(recurringContributions.id, contributionId),
          eq(recurringContributions.assetId, assetId)
        ),
      });

    if (!existingContribution) {
      throw new Error(
        `Recurring contribution with ID ${contributionId} not found for asset ${assetId}`
      );
    }

    const result = await this.db
      .delete(recurringContributions)
      .where(eq(recurringContributions.id, contributionId));

    return (result?.rowCount ?? 0) > 0;
  }

  async processRecurringContributions(): Promise<number> {
    const now = new Date();
    let processedCount = 0;

    // Find all active recurring contributions that need processing
    const dueContributions =
      await this.db.query.recurringContributions.findMany({
        where: and(
          eq(recurringContributions.isActive, true),
          lte(
            recurringContributions.lastProcessedDate,
            this.getNextProcessingDate(now, "weekly")
          ) // Most aggressive interval
        ),
      });

    // Process each contribution that is due
    for (const contribution of dueContributions) {
      const nextDate = this.getNextProcessingDate(
        contribution.lastProcessedDate,
        contribution.interval as ContributionInterval
      );

      // Check if the next processing date is due
      if (nextDate <= now) {
        // Create a contribution (debit) entry
        await this.createUserAssetTransaction(contribution.assetId, {
          value: contribution.amount,
          valueDate: new Date(),
          recordedAt: new Date(),
          // currency: "GBP", default GBP is set at the DB level
          // currencyValue: contribution.currencyValue, set to default zero at DB level
          // fees: contribution.fees, set to default zero at DB level
        });

        // Update the last processed date
        await this.db
          .update(recurringContributions)
          .set({
            lastProcessedDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(recurringContributions.id, contribution.id));

        processedCount++;
      }
    }

    return processedCount;
  }

  private getNextProcessingDate(
    lastDate: Date | null,
    interval: ContributionInterval
  ): Date {
    const nextDate = lastDate ? new Date(lastDate) : new Date();

    switch (interval) {
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "biweekly":
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        throw new Error(`Invalid interval: ${interval}`);
    }

    return nextDate;
  }

  /* Asset Securities */

  async getUserAssetSecurities(
    assetId: UserAsset["id"],
    query: QueryParams
  ): Promise<UserAssetSecuritySelect[]> {
    const { where, orderBy, limit, offset } =
      userAssetSecuritiesQueryBuilder.buildQuery(query);
    return this.db.query.userAssetSecurities.findMany({
      with: { security: true },
      where: and(eq(userAssetSecurities.userAssetId, assetId), where),
      orderBy: orderBy || [desc(userAssetSecurities.recordedAt)],
      limit,
      offset,
    });
  }

  async getUserAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"]
  ): Promise<ResolvedSecurity> {
    console.log("getUserAssetSecurity", assetId, securityId);

    const security = await this.db.query.userAssetSecurities.findFirst({
      where: and(
        eq(userAssetSecurities.userAssetId, assetId),
        eq(userAssetSecurities.id, securityId)
      ),
      with: { security: true },
    });
    if (!security) {
      throw new Error(
        `User asset security with ID ${securityId} not found for asset ${assetId}`
      );
    }
    return security as ResolvedSecurity;
  }

  async createUserAssetSecurity(
    assetId: UserAsset["id"],
    data: UserAssetSecurityInsert
  ): Promise<UserAssetSecuritySelect> {
    // Make sure the asset exists
    const asset = await this.getUserAsset(assetId);
    if (!asset) {
      throw new Error(`User asset with ID ${assetId} not found`);
    }

    // Make sure the security exists
    const security = await this.getCachedSecurity(data.securityId);
    if (!security) {
      throw new Error(`Security with ID ${data.securityId} not found`);
    }

    const [insertedValueItem] = await this.db
      .insert(userAssetSecurities)
      .values({
        ...data,
        userAssetId: assetId,
      })
      .returning();

    if (!insertedValueItem) {
      throw new Error("Failed to create user asset security");
    }

    return insertedValueItem;
  }

  async updateBrokerProviderAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"],
    data: UserAssetSecurityInsert
  ): Promise<UserAssetSecuritySelect> {
    // Make sure the value item exists and belongs to the asset
    const existingValueItem = await this.db.query.userAssetSecurities.findFirst(
      {
        where: and(
          eq(userAssetSecurities.id, securityId),
          eq(userAssetSecurities.userAssetId, assetId)
        ),
      }
    );

    if (!existingValueItem) {
      throw new Error(
        `User asset security with ID ${securityId} not found for asset ${assetId}`
      );
    }

    const [updatedValueItem] = await this.db
      .update(userAssetSecurities)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userAssetSecurities.id, securityId))
      .returning();

    if (!updatedValueItem) {
      throw new Error("Failed to update user asset security");
    }

    return updatedValueItem;
  }

  async deleteBrokerProviderAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"]
  ): Promise<boolean> {
    // Make sure the value item exists and belongs to the asset
    const existingValueItem = await this.db.query.userAssetSecurities.findFirst(
      {
        where: and(
          eq(userAssetSecurities.id, securityId),
          eq(userAssetSecurities.userAssetId, assetId)
        ),
      }
    );

    if (!existingValueItem) {
      throw new Error(
        `User asset security with ID ${securityId} not found for asset ${assetId}`
      );
    }

    const result = await this.db
      .delete(userAssetSecurities)
      .where(eq(userAssetSecurities.id, securityId));

    return (result?.rowCount ?? 0) > 0;
  }
}

/* Asset Persistence Utility */

export type AssetPersistence = {
  getAssetById: () => Promise<{ id: string }>;
  getLastAssetValue: () => Promise<AssetValue | null>;
  getAssetSecurities: () => Promise<AssetSecurity[]>;
  insertAssetValues: (
    values: UserAssetValueOrphanInsert[]
  ) => Promise<AssetValue[]>;
};

export const assetPersistenceFactory = (
  service: DatabaseAssetService,
  assetId: string
): AssetPersistence => {
  return {
    getAssetById: async (): Promise<{ id: string }> => {
      return service.getUserAsset(assetId);
    },

    getLastAssetValue: async (): Promise<AssetValue | null> => {
      const historyOfOne = await service.getUserAssetValueHistory(assetId, {
        limit: 1,
        sort: [{ field: "recordedAt", direction: "desc" }],
      });

      return historyOfOne.at(-1) ?? null;
    },

    getAssetSecurities: async (): Promise<AssetSecurity[]> => {
      const securities = await service.getUserAssetSecurities(assetId, {
        limit: 1000,
        sort: [{ field: "recordedAt", direction: "desc" }],
      });
      return securities.map((security) => ({
        securityId: security.securityId,
        symbol: security.security.symbol,
        exchange: security.security.exchange ?? undefined,
        shareHolding: security.shareHolding,
        gainLoss: security.gainLoss,
        startDate: security.startDate,
      }));
    },

    insertAssetValues: async (
      values: UserAssetValueOrphanInsert[]
    ): Promise<AssetValue[]> => {
      return service.pushAssetValuesForAsset(assetId, values);
    },
  };
};
