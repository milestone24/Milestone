import {
  assetValues,
  userAssets,
  recurringContributions,
  securities,
  userAssetAPIKeyConnections,
  assetTransactions,
  userAssetSecurities,
  securityTransactions,
  securityDailyHistory,
  SchedulePattern,
} from "server/db/schema";
import { Database } from "../../db";
import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  sum,
} from "drizzle-orm";
import {
  UserAsset,
  AssetContribution,
  AssetValue,
  BrokerProvider,
  UserAccount,
  AssetsChange,
  UserAssetValueOrphanInsert,
  RecurringContribution,
  RecurringContributionOrphanInsert,
  ContributionInterval,
  WithAssetHistory,
  DataRangeQuery,
  UserAssetSecuritySelect,
  UserAssetSecurityInsert,
  ResolvedSecurity,
  BrokerPlatform,
  UserAssetWithHistoryAndAccountChange,
  UserAssetInsert,
  UserAssetTransactionOrphanInsert,
  AssetTransaction,
  ResolvedUserAsset,
  AssetHistoryTimePoint,
  SecurityTransactionOrphanInsert,
  SecurityTransaction,
  UserAssetSecurityTransactionResolved,
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
  resolveDate,
  getPortfolioOverviewForAssets,
  resolveDayValueHistoryForAssetsForDateRange,
  resolveDayValueHistoryForAssetForDateRange,
  dateRangeToQueryFilter,
  queryParamsFilterToDateRange,
} from "@shared/utils/assets";

import { factory as securitiesFactory } from "@server/services/securities";
import { AssetSecurity } from "../securities/types";
import { union, unionAll } from "drizzle-orm/pg-core";
import { getNextExecutionDate } from "@shared/utils/scheduling";

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
  allowedSortFields: ["valueDate"],
  allowedFilterFields: [],
  defaultSort: { field: "valueDate", direction: "asc" },
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
    "isActive",
  ],
  allowedFilterFields: ["isActive"],
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

  async getUserAssetHistory(
    assetId: UserAsset["id"],
    query: QueryParams
  ): Promise<AssetValue[]> {
    const {
      /**@ts-ignore */
      start: { eq: start } = { eq: null },
      /**@ts-ignore */
      end: { eq: end } = { eq: null },
    } = query.filter;

    const startDate = resolveDate(start);
    const endDate = resolveDate(end);

    const historyResult = await this.db
      .select()
      .from(assetValues)
      .where(
        and(
          eq(assetValues.assetId, assetId),
          startDate != null && endDate != null
            ? between(assetValues.valueDate, startDate, endDate)
            : startDate != null
            ? gte(assetValues.valueDate, startDate)
            : endDate != null
            ? lte(assetValues.valueDate, endDate)
            : undefined
        )
      )
      .orderBy(asc(assetValues.valueDate));

    return historyResult;
  }

  //TODO implement this??
  // async getResolvedUserAssetHistory(
  //   assetId: UserAsset["id"],
  //   query: QueryParams
  // ): Promise<
  //   {
  //     assetValues: AssetValue;
  //     securities: UserAssetSecuritySelect[] | null;
  //   }[]
  // > {
  //   const {
  //     /**@ts-ignore */
  //     start: { eq: start } = { eq: null },
  //     /**@ts-ignore */
  //     end: { eq: end } = { eq: null },
  //   } = query.filter;

  //   const startDate = resolveDate(start);
  //   const endDate = resolveDate(end);

  //   const historyResult = await this.db
  //     .select({
  //       assetValues,
  //       securities: userAssetSecurities,
  //     })
  //     .from(assetValues)
  //     .leftJoin(
  //       userAssetSecurities,
  //       eq(assetValues.assetId, userAssetSecurities.userAssetId)
  //     )
  //     .leftJoin(
  //       securityTransactions,
  //       eq(userAssetSecurities.securityId, securityTransactions.securityId)
  //     )
  //     .where(
  //       and(
  //         eq(assetValues.assetId, assetId),
  //         startDate != null && endDate != null
  //           ? between(assetValues.valueDate, startDate, endDate)
  //           : startDate != null
  //           ? gte(assetValues.valueDate, startDate)
  //           : endDate != null
  //           ? lte(assetValues.valueDate, endDate)
  //           : undefined
  //       )
  //     )
  //     .orderBy(asc(assetValues.valueDate));

  //   return historyResult;
  // }

  async getUserAssetHistoryWithBoundary(
    assetId: UserAsset["id"],
    query?: QueryParams
  ): Promise<AssetValue[]> {
    const dateRange = queryParamsFilterToDateRange(query?.filter);

    const startDate = resolveDate(dateRange.start);
    const endDate = resolveDate(dateRange.end);

    const mainQuery = this.db
      .select()
      .from(assetValues)
      .where(
        and(
          eq(assetValues.assetId, assetId),
          startDate != null && endDate != null
            ? between(assetValues.valueDate, startDate, endDate)
            : startDate != null
            ? gte(assetValues.valueDate, startDate)
            : endDate != null
            ? lte(assetValues.valueDate, endDate)
            : undefined
        )
      );

    const beforeQuery = this.db
      .select()
      .from(assetValues)
      .where(
        startDate
          ? and(
              eq(assetValues.assetId, assetId),
              lt(assetValues.valueDate, startDate)
            )
          : and(eq(assetValues.assetId, assetId))
      )
      .orderBy(desc(assetValues.valueDate))
      .limit(1);

    const afterQuery = this.db
      .select()
      .from(assetValues)
      .where(
        endDate
          ? and(
              eq(assetValues.assetId, assetId),
              gt(assetValues.valueDate, endDate)
            )
          : and(eq(assetValues.assetId, assetId))
      )
      .orderBy(asc(assetValues.valueDate))
      .limit(1);

    const allData =
      startDate && endDate
        ? await unionAll(mainQuery, beforeQuery, afterQuery).orderBy(
            asc(assetValues.valueDate)
          )
        : startDate
        ? await unionAll(mainQuery, beforeQuery).orderBy(
            asc(assetValues.valueDate)
          )
        : endDate
        ? await unionAll(mainQuery, afterQuery).orderBy(
            asc(assetValues.valueDate)
          )
        : await mainQuery.orderBy(asc(assetValues.valueDate));

    // console.log(
    //   "allData",
    //   [...allData.slice(0, 3), ...allData.slice(-3)].map(
    //     (item) => item.valueDate
    //   )
    // );

    return allData;
  }

  async getUserAssetsWithAssetValueHistory(
    userId: UserAccount["id"],
    query: QueryParams
  ): Promise<WithAssetHistory<UserAsset>[]> {
    const {
      /**@ts-ignore */
      start: { eq: start } = { eq: null },
      /**@ts-ignore */
      end: { eq: end } = { eq: null },
    } = query.filter;

    const assets = await this.db
      .select()
      .from(userAssets)
      .where(and(eq(userAssets.userAccountId, userId)));

    const results: WithAssetHistory<UserAsset>[] = [];

    for (const asset of assets) {
      const historyResult = await this.getUserAssetHistory(asset.id, query);

      results.push({
        ...asset,
        history: historyResult,
      });
    }

    return results;
  }

  /**
   * This will obtain the history of the assets values within a date range if given
   * plus the one asset value before the start date and one after the end date
   * to be able to calculate the boundaries when graphing the history of the asset
   */
  async getUserAssetsWithAssetValueHistoryWithBoundary(
    userId: UserAccount["id"],
    query?: QueryParams
  ): Promise<WithAssetHistory<UserAsset>[]> {
    const assets = await this.db
      .select()
      .from(userAssets)
      .where(and(eq(userAssets.userAccountId, userId)));

    const results: WithAssetHistory<UserAsset>[] = [];

    for (const asset of assets) {
      const allData = await this.getUserAssetHistoryWithBoundary(
        asset.id,
        query
      );

      results.push({
        ...asset,
        history: allData,
      });
    }

    return results;
  }

  async getUserAssetsWithAccountValueChange(
    userId: UserAccount["id"],
    query: QueryParams | undefined
  ): Promise<UserAssetWithHistoryAndAccountChange[]> {
    const dateRange = queryParamsFilterToDateRange(query?.filter);

    const assets = await this.getUserAssetsWithAssetValueHistoryWithBoundary(
      userId,
      query
    );

    return resolveAssetsWithChange(assets, dateRange);
  }

  async getUserAsset(id: UserAsset["id"]): Promise<ResolvedUserAsset> {
    const userAsset = await this.db.transaction<ResolvedUserAsset>(
      async (tx) => {
        const userAsset = await tx.query.userAssets.findFirst({
          with: {
            platform: true,
            securities: { with: { security: true } },
          },
          where: eq(userAssets.id, id),
        });

        if (!userAsset) {
          throw new Error("User asset not found");
        }

        const latestValue = await tx.query.assetValues.findFirst({
          where: eq(assetValues.assetId, id),
          orderBy: (assetValues, { desc }) => [desc(assetValues.valueDate)],
        });

        //TODO move to seperate method to avoid code duplication
        const securitiesWithValue: ResolvedSecurity[] = await Promise.all(
          userAsset.securities.map(async (security) => {
            const lastValue = await tx.query.securityDailyHistory.findFirst({
              where: eq(securityDailyHistory.securityId, security.securityId),
              orderBy: (securityDailyHistory, { desc }) => [
                desc(securityDailyHistory.date),
              ],
            });

            const shareHoldings = await tx
              .select({
                sum: sum(securityTransactions.value),
              })
              .from(securityTransactions)
              .where(eq(securityTransactions.securityId, security.id));

            return {
              ...security,
              calculatedValue: {
                value: lastValue
                  ? Number(
                      (
                        Number(lastValue.close ?? 0) *
                        Number(shareHoldings?.[0]?.sum ?? 0)
                      ).toFixed(2)
                    )
                  : 0,
                //Todo calculate this when we have a date range
                currentChange: 0,
                currentChangePercentage: 0,
              },
            };
          })
        );

        return {
          ...userAsset,
          currentValue: latestValue?.value ?? 0,
          lastValueDate: latestValue?.valueDate ?? null,
          platform: userAsset.platform ?? undefined,
          securities: securitiesWithValue,
        };
      }
    );

    return userAsset;
  }

  async getUserAssetValueHistory(
    id: UserAsset["id"],
    query: QueryParams
  ): Promise<AssetValue[]> {
    const { where, orderBy, limit, offset } =
      assetValuesQueryBuilder.buildQuery(query);
    return this.db.query.assetValues.findMany({
      where: and(eq(assetValues.assetId, id), where),
      orderBy,
      limit,
      offset,
    });
  }

  async getUserAssetValueHistoryGraph(
    id: UserAsset["id"],
    query?: DataRangeQuery
  ): Promise<AssetHistoryTimePoint[]> {
    const asset = await this.db.query.userAssets.findFirst({
      where: eq(userAssets.id, id),
    });

    if (!asset) {
      throw new Error("Asset not found");
    }

    const assetValues = await this.getUserAssetHistoryWithBoundary(id, {
      filter: {
        start: {
          eq: query?.start,
        },
        end: {
          eq: query?.end,
        },
      },
    });

    const result = await resolveDayValueHistoryForAssetForDateRange(
      {
        ...asset,
        history: assetValues,
      },
      query
    );

    return result;
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

      if (data.valueMethod === "calculated") {
        await Promise.all(
          data.securities.map(async (security) => {
            const persistedSecurity =
              await securitiesService.createOrFindCachedSecurity(
                security.security
              );
            const assetSecurityData = {
              securityId: persistedSecurity.id,
              userAssetId: insertedUserAsset.id,
              recordedAt: security.recordedAt ?? new Date(),
              shareHolding: security.shareHolding,
              currencyValue: security.currencyValue,
              startDate: security.startDate,
              priorGainLoss: security.priorGainLoss,
              currency: persistedSecurity.currency ?? "GBP",
            };

            const [assetSecurity] = await tx
              .insert(userAssetSecurities)
              .values(assetSecurityData)
              .returning();

            if (!assetSecurity) {
              throw new Error("Failed to create user asset security");
            }

            const transaction = await tx.insert(securityTransactions).values({
              securityId: assetSecurity.id,
              value: assetSecurityData.shareHolding,
              currency: persistedSecurity.currency ?? "GBP",
              currencyValue: assetSecurityData.currencyValue,
              recordedAt: new Date(),
              valueDate: insertedUserAsset.startDate,
            });

            if (!transaction) {
              throw new Error("Failed to create security transaction");
            }
          })
        );
      }

      if (data.valueMethod === "manual") {
        await tx.insert(assetTransactions).values({
          assetId: insertedUserAsset.id,
          value: data.currentValue ?? 0,
          valueDate: data.startDate,
          recordedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await tx.insert(assetValues).values({
          assetId: insertedUserAsset.id,
          value: data.currentValue ?? 0,
          valueDate: data.startDate,
          recordedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      console.log("data.contributions", data.contributions);

      // if (data.contributions) {
      //   if (data.valueMethod === "manual") {
      //     await tx.insert(recurringContributions).values({
      //       assetId: insertedUserAsset.id,
      //       amount: data.contributions.amount,
      //       startDate: data.startDate,
      //       pattern: data.contributions.schedulePattern,
      //       isActive: true,
      //     });
      //   }
      //   if (data.valueMethod === "calculated") {
      //   }
      // }

      return insertedUserAsset;
    });

    const assetPersistence = assetPersistenceFactory(
      this,
      insertedUserAsset.id
    );

    await securitiesService.updateAssetValues(assetPersistence);

    return insertedUserAsset;
  }

  // async updateManualAssetValues(assetId: UserAsset["id"]): Promise<void> {

  //   const

  // }

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

  async getUserAssetSecurityTransactionHistory(
    assetId: UserAsset["id"]
  ): Promise<UserAssetSecurityTransactionResolved[]> {
    const securityTransactionHistory = await this.db
      .select()
      .from(userAssetSecurities)
      .where(eq(userAssetSecurities.userAssetId, assetId))
      .innerJoin(securities, eq(userAssetSecurities.securityId, securities.id))
      .innerJoin(
        securityTransactions,
        eq(userAssetSecurities.id, securityTransactions.securityId)
      )
      .orderBy(desc(securityTransactions.valueDate));

    return securityTransactionHistory.reduce(
      (
        acc: UserAssetSecurityTransactionResolved[],
        curr
      ): UserAssetSecurityTransactionResolved[] => {
        acc.push({
          id: curr.security_transactions.id,
          securityName: curr.securities.name,
          value: curr.security_transactions.value,
          currency: curr.security_transactions.currency,
          currencyValue: curr.security_transactions.currencyValue ?? 0,
          valueDate: curr.security_transactions.valueDate,
        });
        return acc;
      },
      []
    );
  }

  async createUserAssetSecurityTransaction(
    securityId: string,
    data: SecurityTransactionOrphanInsert
  ): Promise<SecurityTransaction> {
    const [securityTransaction] = await this.db
      .insert(securityTransactions)
      .values({
        securityId,
        ...data,
        recordedAt: data.recordedAt ?? new Date(),
      })
      .returning();

    if (!securityTransaction) {
      throw new Error("Failed to create security transaction");
    }

    const assetSecurity = await this.db.query.userAssetSecurities.findFirst({
      where: eq(userAssetSecurities.id, securityId),
    });

    if (!assetSecurity) {
      throw new Error("Asset security not found, can not update asset values");
    }

    //TODO this should be a background process??
    await this.clearAndUpdateAssetValuesFromDate(
      assetSecurity.userAssetId,
      data.valueDate
    );

    return securityTransaction;
  }

  async clearAndUpdateAssetValuesFromDate(
    assetId: UserAsset["id"],
    date: Date
  ): Promise<void> {
    await this.db
      .delete(assetValues)
      .where(
        and(eq(assetValues.assetId, assetId), gte(assetValues.valueDate, date))
      );
    const assetPersistence = assetPersistenceFactory(this, assetId);
    await securitiesService.updateAssetValues(assetPersistence);
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

  // private async getPortfolioAssetValuesForAssetsForDateRange(
  //   assetIds: UserAsset["id"][],
  //   query?: DataRangeQuery
  // ): Promise<AssetValue[]> {
  //   const startDate = resolveDate(query?.start);
  //   const endDate = resolveDate(query?.end);

  //   const dateQueries =
  //     startDate && endDate
  //       ? [between(assetValues.valueDate, startDate, endDate)]
  //       : startDate
  //       ? [gte(assetValues.valueDate, startDate)]
  //       : endDate
  //       ? [lte(assetValues.valueDate, endDate)]
  //       : [];

  //   const assetValuesQuery: QueryParts = {
  //     where: and(inArray(assetValues.assetId, assetIds), ...dateQueries),
  //     orderBy: [desc(assetValues.valueDate)],
  //   };

  //   const { where, orderBy, limit, offset } = assetValuesQuery;

  //   const assetValuesToCalculate = await this.db.query.assetValues.findMany({
  //     where,
  //     orderBy,
  //     limit,
  //     offset,
  //   });

  //   return assetValuesToCalculate as AssetValue[];
  // }

  async getPortfolioOverviewForUser(
    userAccountId: UserAccount["id"],
    query?: QueryParams
  ): Promise<AssetsChange> {
    const assetsWithChange = await this.getUserAssetsWithAccountValueChange(
      userAccountId,
      query
    );

    const change = await getPortfolioOverviewForAssets(assetsWithChange);

    return change;
  }

  async getPortfolioValueHistoryForUser(
    userAccountId: UserAccount["id"],
    query?: QueryParams
  ): Promise<AssetHistoryTimePoint[]> {
    const assetsWithHistory =
      await this.getUserAssetsWithAssetValueHistoryWithBoundary(
        userAccountId,
        query
      );

    return resolveDayValueHistoryForAssetsForDateRange(
      assetsWithHistory,
      queryParamsFilterToDateRange(query?.filter)
    );
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
            now
            //this.getNextProcessingDate(now, contribution.pattern)
          ) // Most aggressive interval
        ),
      });

    // Process each contribution that is due
    for (const contribution of dueContributions) {
      const nextDate = this.getNextProcessingDate(
        contribution.lastProcessedDate,
        contribution.pattern
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
    pattern: SchedulePattern
  ): Date {
    const nextDate = lastDate ? new Date(lastDate) : new Date();

    if (pattern.type === "rrule") {
      return getNextExecutionDate(pattern, nextDate, new Date()) ?? nextDate;
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
    const security = await securitiesService.getCachedSecurity(data.securityId);

    if (!security) {
      throw new Error(`Security with ID ${data.securityId} not found`);
    }

    const value = await this.db.transaction(async (tx) => {
      const [insertedValueItem] = await tx
        .insert(userAssetSecurities)
        .values({
          ...data,
          userAssetId: assetId,
        })
        .returning();

      const value = await tx.query.userAssetSecurities.findFirst({
        where: and(
          eq(userAssetSecurities.userAssetId, assetId),
          eq(userAssetSecurities.securityId, security.id)
        ),
        with: { security: true },
      });

      return value;
    });

    if (!value) {
      throw new Error("Failed to create user asset security");
    }

    return value;
  }

  async updateUserAssetSecurity(
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

    const value = await this.db.transaction(async (tx) => {
      const [updatedValueItem] = await tx
        .update(userAssetSecurities)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(userAssetSecurities.id, securityId))
        .returning();

      const value = await tx.query.userAssetSecurities.findFirst({
        where: and(
          eq(userAssetSecurities.id, securityId),
          eq(userAssetSecurities.userAssetId, assetId)
        ),
        with: { security: true },
      });

      return value;
    });

    if (!value) {
      throw new Error("Failed to update user asset security");
    }

    return value;
  }

  async deleteUserAssetSecurity(
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

  /**
   * Get the share holdings for all securities in the asset for a given date
   * @param assetId
   * @param date
   * @returns
   */
  async getUserAssetSecurityShareHoldingsForDate(
    assetId: UserAsset["id"],
    date: Date
  ): Promise<AssetSecurityShareHoldingsForDate[]> {
    const result = await this.db.transaction(async (tx) => {
      const s = await this.db
        .select({
          securityId: userAssetSecurities.securityId,
          shareHolding: sum(securityTransactions.value),
        })
        .from(userAssetSecurities)
        .innerJoin(
          securityTransactions,
          eq(userAssetSecurities.id, securityTransactions.securityId)
        )
        .groupBy(userAssetSecurities.securityId)
        .where(
          and(
            eq(userAssetSecurities.userAssetId, assetId),
            lte(securityTransactions.valueDate, date)
          )
        );

      return s;
    });

    return result.map((r) => ({
      securityId: r.securityId,
      shareHolding: Number(r.shareHolding ?? 0),
    }));
  }
}

/* Asset Persistence Utility */

export type AssetPersistence = {
  getAssetById: () => Promise<{ id: string }>;
  getLastAssetValue: () => Promise<AssetValue | null>;
  getAssetSecurities: () => Promise<AssetSecurity[]>;
  getAssetSecurityShareHoldingsForDate: (
    date: Date
  ) => Promise<AssetSecurityShareHoldingsForDate[]>;
  insertAssetValues: (
    values: UserAssetValueOrphanInsert[]
  ) => Promise<AssetValue[]>;
};

export type AssetSecurityShareHoldingsForDate = {
  securityId: string;
  shareHolding: number;
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
        sort: [{ field: "valueDate", direction: "desc" }],
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
        // shareHolding: security.shareHolding,
        // gainLoss: security.gainLoss,
        startDate: security.startDate,
      }));
    },

    getAssetSecurityShareHoldingsForDate: async (
      date: Date
    ): Promise<AssetSecurityShareHoldingsForDate[]> => {
      return service.getUserAssetSecurityShareHoldingsForDate(assetId, date);
    },

    insertAssetValues: async (
      values: UserAssetValueOrphanInsert[]
    ): Promise<AssetValue[]> => {
      return service.pushAssetValuesForAsset(assetId, values);
    },
  };
};
