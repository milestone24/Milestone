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
  processes,
} from "@server/db/schema";
import { Database } from "../../db";
import {
  and,
  asc,
  between,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  lt,
  lte,
  sql,
  sum,
} from "drizzle-orm";
import {
  UserAsset,
  AssetTransaction,
  AssetValue,
  BrokerProvider,
  UserAccount,
  AssetsChange,
  UserAssetValueOrphanInsert,
  RecurringContribution,
  RecurringContributionOrphanInsert,
  WithAssetHistory,
  DataRangeQuery,
  UserAssetSecuritySelect,
  ResolvedAssetSecurity,
  BrokerPlatform,
  UserAssetWithHistoryAndAccountChange,
  UserAssetInsert,
  UserAssetTransactionOrphanInsert,
  ResolvedUserAsset,
  AssetValueTimePoint,
  SecurityTransactionOrphanInsert,
  SecurityTransaction,
  UserAssetSecurityTransactionResolved,
  TransactionAbstract,
  CombinedValueHistory,
  TransactionTimePoint,
  ValueAbstractType,
  BrandedAssetValue,
  BrandedAssetTransactionValue,
  BrandedValue,
  BrandedUserAssetSecurityTransactionResolved,
  BrandedAbstractTransactionValue,
  TransactionType,
  AssetWithValueHistory,
  WithValueHistory,
  UserAssetWithValue,
  createDecimalValueString,
  DecimalValueString,
  UserAssetSecurityLinkInsert,
  UserAssetSecurityOrphanCreate,
  UserAssetSecurityOrphanLinkInsert,
  UserAssetWithValueChange,
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
  resolveDayTransactionHistoryForAssetsForDateRange,
} from "@shared/utils/assets";

import { factory as securitiesFactory } from "@server/services/securities";
import { AssetSecurity } from "../securities/types";
import { union, unionAll } from "drizzle-orm/pg-core";
import { getNextExecutionDate } from "@shared/utils/scheduling";
import { connections } from "@server/sockets/connections";
import { SocketMessage } from "@shared/schema/socket";
import {
  assetSecurities,
  fireProjection,
  portfolioAssets,
  portfolioGraphTransactions,
  portfolioGraphValues,
  portfolioOverview,
  processes as processesKey,
} from "@shared/api/queryKeys";
import { randomUUID } from "node:crypto";
import { calculatedAssetsQueryBuilder } from "./query";
import Decimal from "decimal.js";
import { ProcessSelect } from "@shared/schema/process";
import { getUserAccountId } from "@server/auth";
import { AssetValuesService } from "../process/asset-values";
import {
  Cached,
  buildCacheKey,
  InvalidatesCache,
  queryParamsToKeyRoundedDates,
} from "@server/services/cache";

const securitiesService = securitiesFactory();

//type Transaction = NodePgTransaction<Schema, TSchema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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
  allowedSortFields: ["createdAt"],
  allowedFilterFields: [],
  defaultSort: { field: "createdAt", direction: "desc" },
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
  private assetValuesService: AssetValuesService;
  constructor(private db: Database) {
    this.assetValuesService = new AssetValuesService(db);
  }

  // private async recalculateAssetValue(
  //   tx: Transaction,
  //   assetId: UserAsset["id"]
  // ): Promise<void> {
  //   // Get the most recent history entry for the account
  //   const latestHistory = await tx.query.assetValues.findFirst({
  //     where: eq(assetValues.assetId, assetId),
  //     orderBy: (assetValues, { desc }) => [desc(assetValues.recordedAt)],
  //   });

  //   if (latestHistory) {
  //     // Update the account's current value with the latest history value
  //     await tx
  //       .update(userAssets)
  //       .set({ currentValue: latestHistory.value })
  //       .where(eq(userAssets.id, assetId));
  //   }
  // }

  // private async withValueTransaction<T>(
  //   operation: (tx: Transaction) => Promise<T>,
  //   assetId: UserAsset["id"]
  // ): Promise<T> {
  //   return this.db.transaction(async (tx) => {
  //     const result = await operation(tx);
  //     await this.recalculateAssetValue(tx, assetId);
  //     return result;
  //   });
  // }

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
  ): Promise<BrandedAssetValue[]> {
    const dateRange = queryParamsFilterToDateRange(query?.filter);

    const startDate = resolveDate(dateRange.start);
    const endDate = resolveDate(dateRange.end);

    const select = {
      ...getTableColumns(assetValues),
      recordType: sql<Extract<ValueAbstractType, "asset_value">>`'asset_value'`,
    };

    const mainQuery = this.db
      .select(select)
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
      .select(select)
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
      .select(select)
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

    return allData;
  }

  async getUserAssetsWithAssetValueHistory(
    userId: UserAccount["id"],
    query: QueryParams
  ): Promise<WithAssetHistory<UserAssetWithValue, AssetValue>[]> {
    const {
      /**@ts-ignore */
      start: { eq: start } = { eq: null },
      /**@ts-ignore */
      end: { eq: end } = { eq: null },
    } = query.filter;

    const assets = await calculatedAssetsQueryBuilder(this.db)
      .where(and(eq(userAssets.userAccountId, userId)))
      .execute();

    const results: WithAssetHistory<UserAssetWithValue, AssetValue>[] = [];

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
   * Minimal boundary candidates needed to calculate day-based start/end change.
   *
   * This intentionally does NOT fetch the full range history and does NOT include "after end"
   * (that is useful for graphing continuity, not for start->end change).
   *
   * Returns up to 4 rows:
   * - earliest value on start day
   * - latest value before start day
   * - latest value on end day
   * - latest value before end day
   */
  async getUserAssetWithBoundaryCandidates(
    assetId: UserAsset["id"],
    startDate: Date,
    endDate: Date
  ): Promise<BrandedAssetValue[]> {
    const toUTCMidnight = (date: Date): Date =>
      new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      );

    const startDay = toUTCMidnight(startDate);
    const endDay = toUTCMidnight(endDate);

    const startDayNext = new Date(startDay.getTime() + 24 * 60 * 60 * 1000);
    const endDayNext = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);

    const select = {
      ...getTableColumns(assetValues),
      recordType: sql<Extract<ValueAbstractType, "asset_value">>`'asset_value'`,
    };

    // earliest value on start day
    const startDayQuery = this.db
      .select(select)
      .from(assetValues)
      .where(
        and(
          eq(assetValues.assetId, assetId),
          gte(assetValues.valueDate, startDay),
          lt(assetValues.valueDate, startDayNext)
        )
      )
      .orderBy(
        asc(assetValues.valueDate),
        asc(assetValues.recordedAt),
        asc(assetValues.id)
      )
      .limit(1);

    // latest value before start day
    const beforeStartQuery = this.db
      .select(select)
      .from(assetValues)
      .where(
        and(
          eq(assetValues.assetId, assetId),
          lt(assetValues.valueDate, startDay)
        )
      )
      .orderBy(
        desc(assetValues.valueDate),
        desc(assetValues.recordedAt),
        desc(assetValues.id)
      )
      .limit(1);

    // latest value on end day
    const endDayQuery = this.db
      .select(select)
      .from(assetValues)
      .where(
        and(
          eq(assetValues.assetId, assetId),
          gte(assetValues.valueDate, endDay),
          lt(assetValues.valueDate, endDayNext)
        )
      )
      .orderBy(
        desc(assetValues.valueDate),
        desc(assetValues.recordedAt),
        desc(assetValues.id)
      )
      .limit(1);

    // latest value before end day
    const beforeEndQuery = this.db
      .select(select)
      .from(assetValues)
      .where(
        and(eq(assetValues.assetId, assetId), lt(assetValues.valueDate, endDay))
      )
      .orderBy(
        desc(assetValues.valueDate),
        desc(assetValues.recordedAt),
        desc(assetValues.id)
      )
      .limit(1);

    const rows = await unionAll(
      startDayQuery,
      beforeStartQuery,
      endDayQuery,
      beforeEndQuery
    ).orderBy(asc(assetValues.valueDate));

    // Deduplicate in case a candidate is the same row (e.g. start-day exists and is also "before end").
    const seen = new Set<string>();
    const deduped: BrandedAssetValue[] = [];
    for (const row of rows) {
      const key = `${row.id ?? "null"}|${row.valueDate.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    return deduped;
  }

  /**
   * Fetches ONLY the minimal set of asset value "boundary candidates" needed to calculate
   * day-based start/end change for a date range (no full history).
   *
   * This is intended to support a lightweight "assets with account change" response where:
   * - We keep the existing day-based boundary semantics used by `defineAssetValuesForDateRange`
   * - We avoid fetching all values within the range
   *
   * Candidate selection (per asset, depending on query):
   * - start-day earliest value (if start provided)
   * - last value before start-day (if start provided)
   * - end-day latest value (if end provided)
   * - last value before end-day (if end provided)
   *
   * If no start/end is provided, we fall back to:
   * - earliest overall value
   * - latest overall value
   *
   * Note: returned `history` is intentionally sparse and only meant for change calculation.
   */
  async getUserAssetsWithBoundaryCandidates(
    userId: UserAccount["id"],
    query?: QueryParams
  ): Promise<WithAssetHistory<UserAssetWithValue, BrandedAssetValue>[]> {
    const assets = await calculatedAssetsQueryBuilder(this.db)
      .where(and(eq(userAssets.userAccountId, userId)))
      .execute();

    const dateRange = queryParamsFilterToDateRange(query?.filter);

    const startResolved = resolveDate(dateRange.start);
    const endResolved = resolveDate(dateRange.end);

    if (!startResolved || !endResolved) {
      throw new Error(
        "getUserAssetsWithBoundaryCandidates requires both start and end dates for change calculation"
      );
    }

    return await Promise.all(
      assets.map(async (asset) => {
        const candidates = await this.getUserAssetWithBoundaryCandidates(
          asset.id,
          startResolved,
          endResolved
        );

        return {
          ...asset,
          history: candidates,
        };
      })
    );
  }

  /**
   * This will obtain the history of the assets values within a date range if given
   * plus the one asset value before the start date and one after the end date
   * to be able to calculate the boundaries when graphing the history of the asset
   */
  async getUserAssetsWithAssetValueHistoryWithBoundary(
    userId: UserAccount["id"],
    query?: QueryParams
  ): Promise<WithAssetHistory<UserAssetWithValue, BrandedAssetValue>[]> {
    const assets = await calculatedAssetsQueryBuilder(this.db)
      .where(and(eq(userAssets.userAccountId, userId)))
      .execute();

    const results: WithAssetHistory<UserAssetWithValue, BrandedAssetValue>[] =
      [];

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

  @Cached({
    namespace: "assets",
    keyGenerator: (userAccountId, query) =>
      buildCacheKey(
        "assets",
        userAccountId,
        "with-history-and-account-value-change",
        queryParamsToKeyRoundedDates(query)
      ),
    //ttl: 30 * 60 * 1000, // 5 minutes
    ttl: 0, // forever
  })
  async getUserAssetsWithAccountValueChange(
    userId: UserAccount["id"],
    query: QueryParams | undefined
  ): Promise<UserAssetWithValueChange[]> {
    //): Promise<UserAssetWithHistoryAndAccountChange[]> {
    const dateRange = queryParamsFilterToDateRange(query?.filter);

    //const assets = await this.getUserAssetsWithAssetValueHistoryWithBoundary(
    const assets = await this.getUserAssetsWithBoundaryCandidates(
      userId,
      query
    );

    return resolveAssetsWithChange(assets, dateRange);
  }

  /**
   * TODO
   * Maybe we do not include the resolved securities in the user asset
   * In the asset page in the UI securities are loaded in a separate request.
   * Maybe teh query params here could accept an "includeSecurities" flag
   */
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

        // const securitiesWithValue = await this.getResolvedUserAssetSecurities(
        //   id,
        //   {}
        // );

        return {
          ...userAsset,
          currentValue: latestValue?.value ?? createDecimalValueString("0"),
          lastValueDate: latestValue?.valueDate ?? null,
          platform: userAsset.platform ?? undefined,
          securities: [],
        };
      }
    );

    return userAsset;
  }

  async getResolvedUserAssetSecurities(
    assetId: UserAsset["id"],
    query: QueryParams
  ): Promise<ResolvedAssetSecurity[]> {
    const securities = await this.db.query.userAssetSecurities.findMany({
      where: eq(userAssetSecurities.userAssetId, assetId),
      with: {
        security: true,
      },
    });
    const securitiesWithValue: ResolvedAssetSecurity[] = await Promise.all(
      securities.map(async (security) => {
        const lastValue = await this.db.query.securityDailyHistory.findFirst({
          where: eq(securityDailyHistory.securityId, security.securityId),
          orderBy: (securityDailyHistory, { desc }) => [
            desc(securityDailyHistory.date),
          ],
        });

        const shareHoldings = await this.db
          .select({
            sum: sum(securityTransactions.value),
          })
          .from(securityTransactions)
          .where(eq(securityTransactions.assetSecurityId, security.id));

        return {
          ...security,
          calculatedValue: {
            value: lastValue
              ? createDecimalValueString(
                  Decimal(lastValue.close ?? 0)
                    .mul(Decimal(shareHoldings?.[0]?.sum ?? 0))
                    .toString() as DecimalValueString
                )
              : createDecimalValueString("0"),
            //Todo calculate this when we have a date range
            currentChange: createDecimalValueString("0"),
            currentChangePercentage: createDecimalValueString("0"),
          },
        };
      })
    );

    return securitiesWithValue;
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
  ): Promise<AssetValueTimePoint[]> {
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

    const valueHistory = await resolveDayValueHistoryForAssetsForDateRange(
      [{ ...asset, history: assetValues }],
      query
    );

    return valueHistory;
  }

  async getUserAssetTransactions(
    id: UserAsset["id"],
    query: QueryParams
  ): Promise<BrandedAssetTransactionValue[]> {
    const { where, orderBy, limit, offset } =
      assetTransactionsQueryBuilder.buildQuery(query);

    const select = {
      ...getTableColumns(assetTransactions),
      recordType: sql<Extract<ValueAbstractType, "transaction">>`'transaction'`,
    };

    return this.db
      .select(select)
      .from(assetTransactions)
      .where(and(eq(assetTransactions.assetId, id), where))
      .orderBy(...orderBy)
      .limit(limit ?? 0)
      .offset(offset ?? 0);

    // return this.db.query.assetTransactions.findMany({
    //   where: and(eq(assetTransactions.assetId, id), where),
    //   orderBy,
    //   limit,
    //   offset,
    // });
  }

  async getUserAssetTransactionHistoryGraph(
    id: UserAsset["id"],
    query?: QueryParams
  ): Promise<TransactionTimePoint[]> {
    const asset = await this.db.query.userAssets.findFirst({
      where: eq(userAssets.id, id),
    });

    if (!asset) {
      throw new Error("Asset not found");
    }

    const withHistory = {
      ...asset,
      history: await this.getCombinedAssetTransactionsWithBoundariesForAsset(
        asset.id,
        query
      ),
    };

    const transactionHistory =
      await resolveDayTransactionHistoryForAssetsForDateRange(
        [withHistory],
        queryParamsFilterToDateRange(query?.filter)
      );

    return transactionHistory;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async createUserAsset(data: UserAssetInsert): Promise<UserAsset> {
    const insertedUserAsset = await this.db.transaction(async (tx) => {
      const [insertedUserAsset] = await tx
        .insert(userAssets)
        .values(data)
        .returning();

      if (!insertedUserAsset) {
        throw new Error("Failed to create user asset");
      }

      if (data.valueMethod === "calculated") {
        const groupId = randomUUID();

        await Promise.all(
          data.securities.map(async (security) => {
            const value = await this.createUserAssetSecurity(
              insertedUserAsset.id,
              security,
              tx
            );

            if (
              data.contributions &&
              data.contributions.type === "security" &&
              data.contributions.securityDistribution.length > 0
            ) {
              const securityDistribution =
                data.contributions.securityDistribution.find(
                  (securityDistribution) =>
                    securityDistribution.isTempSecurityId === true &&
                    securityDistribution.securityId === security.lid
                );

              if (securityDistribution) {
                await tx.insert(recurringContributions).values({
                  assetId: insertedUserAsset.id,
                  securityId: value.id,
                  groupId,
                  amount:
                    data.contributions.securityDistribution.length === 1
                      ? data.contributions.amount
                      : createDecimalValueString(
                          Decimal(data.contributions.amount)
                            .mul(
                              Decimal(securityDistribution.commitment).div(100)
                            )
                            .toString()
                        ),
                  startDate: data.startDate,
                  patternConfig: data.contributions.patternConfig,
                  type: "security",
                  process: data.contributions.process,
                  notificationEmail: data.contributions.notificationEmail,
                  notificationPush: data.contributions.notificationPush,
                });
              }
            }
          })
        ).catch((error) => {
          console.error("Failed to create user asset security");
          console.error("Error", error);
          tx.rollback();
          throw new Error("Failed to create user asset security");
        });
      }

      if (data.valueMethod === "manual") {
        await tx.insert(assetTransactions).values({
          assetId: insertedUserAsset.id,
          value: data.currentValue ?? createDecimalValueString("0"),
          valueDate: data.startDate,
          recordedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await tx.insert(assetValues).values({
          assetId: insertedUserAsset.id,
          value: data.currentValue ?? createDecimalValueString("0"),
          valueDate: data.startDate,
          recordedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (data.contributions) {
          await tx.insert(recurringContributions).values({
            assetId: insertedUserAsset.id,
            process: data.contributions.process,
            amount: data.contributions.amount,
            startDate: data.startDate,
            patternConfig: data.contributions.patternConfig,
            type: "asset",
            notificationEmail: data.contributions.notificationEmail,
            notificationPush: data.contributions.notificationPush,
          });
        }
      }

      return insertedUserAsset;
    });

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      insertedUserAsset.userAccountId,
      insertedUserAsset.id
    );

    return insertedUserAsset;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
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

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async deleteUserAsset(id: UserAsset["id"]): Promise<boolean> {
    const userAccountId = getUserAccountId();
    if (!userAccountId) {
      throw new Error("User account not found");
    }

    const result = await this.db.transaction(async (tx) => {
      /**
       * The nested deletes should not need to happen.
       * DB level cascades should be enough.
       */
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

    if (result?.rowCount ?? 0 > 0) {
      this.assetValuesService.sendAssetValuesInvalidatedNotification(
        userAccountId,
        id
      );
    }

    return (result?.rowCount ?? 0) > 0;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async updateUserAssetHistories(id: UserAsset["id"]): Promise<UserAsset> {
    const userAsset = await this.db.query.userAssets.findFirst({
      where: eq(userAssets.id, id),
    });

    if (!userAsset) {
      throw new Error("User asset not found");
    }

    const userAccountId = userAsset.userAccountId;

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      userAccountId,
      id
    );
    return this.getUserAsset(id);
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async createUserAssetValueHistory(
    id: UserAsset["id"],
    data: UserAssetValueOrphanInsert
  ): Promise<AssetValue | undefined> {
    const [insertedAssetValue] = await this.db
      .insert(assetValues)
      .values({
        ...data,
        assetId: id,
      })
      .returning();
    return insertedAssetValue;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
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

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
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

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
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

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async createUserAssetTransaction(
    id: UserAsset["id"],
    data: UserAssetTransactionOrphanInsert
  ): Promise<AssetTransaction> {
    const [insertedAssetTransaction] = await this.db
      .insert(assetTransactions)
      .values({
        ...data,
        assetId: id,
        recordedAt: new Date(),
      })
      .returning();

    if (!insertedAssetTransaction) {
      throw new Error("Failed to create user asset transaction");
    }

    return insertedAssetTransaction;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
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

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
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
  ): Promise<BrandedUserAssetSecurityTransactionResolved[]> {
    const securityTransactionHistory = await this.db
      .select({
        ...getTableColumns(securityTransactions),
        recordType: sql<
          Extract<ValueAbstractType, "transaction">
        >`'transaction'`,
        //type: sql<Extract<ValueAbstractType, "transaction">>`'transaction'`,
        transactionType: sql<TransactionType>`'security'`,

        securityName: securities.name,
        currentValue: sql<string>`cast(sum(${securityTransactions.value}) over (partition by ${securityTransactions.assetSecurityId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`,
        currentCurrencyValue: sql<string>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${securityTransactions.assetSecurityId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`,

        security_transactions: {
          ...getTableColumns(securityTransactions),
          recordType: sql<
            Extract<ValueAbstractType, "transaction">
          >`'transaction'`,
          type: sql<Extract<ValueAbstractType, "transaction">>`'transaction'`,
          transactionType: sql<TransactionType>`'security'`,
          transactionId: securityTransactions.id,
          currentValue: sql<number>`cast(sum(${securityTransactions.value}) over (partition by ${securityTransactions.assetSecurityId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`,
          accumulativeCurrencyValue: sql<number>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${securityTransactions.assetSecurityId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`,
        },
        securities: securities,
      })
      .from(userAssetSecurities)
      .where(eq(userAssetSecurities.userAssetId, assetId))
      .innerJoin(securities, eq(userAssetSecurities.securityId, securities.id))
      .innerJoin(
        securityTransactions,
        eq(userAssetSecurities.id, securityTransactions.assetSecurityId)
      )
      .orderBy(desc(securityTransactions.valueDate));

    return securityTransactionHistory;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async createUserAssetSecurityTransaction(
    assetSecurityId: string,
    data: SecurityTransactionOrphanInsert
  ): Promise<SecurityTransaction> {
    const [securityTransaction] = await this.db
      .insert(securityTransactions)
      .values({
        assetSecurityId,
        ...data,
        recordedAt: data.recordedAt ?? new Date(),
      })
      .returning();

    if (!securityTransaction) {
      throw new Error("Failed to create security transaction");
    }

    const assetSecurity = await this.db.query.userAssetSecurities.findFirst({
      where: eq(userAssetSecurities.id, assetSecurityId),
      with: {
        userAsset: true,
      },
    });

    if (!assetSecurity) {
      throw new Error("Asset security not found, can not update asset values");
    }

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      assetSecurity.userAsset.userAccountId,
      assetSecurity.userAssetId,
      data.valueDate
    );

    return securityTransaction;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async updateUserAssetSecurityTransaction(
    assetId: UserAsset["id"],
    assetSecurityId: string,
    transactionId: string,
    data: SecurityTransactionOrphanInsert
  ): Promise<SecurityTransaction> {
    const accountId = getUserAccountId();

    const [securityTransaction] = await this.db
      .update(securityTransactions)
      .set(data)
      .where(
        and(
          eq(securityTransactions.assetSecurityId, assetSecurityId),
          eq(securityTransactions.id, transactionId)
        )
      )
      .returning();

    if (!securityTransaction) {
      throw new Error("Failed to delete user asset security transaction");
    }

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      accountId,
      assetId,
      data.valueDate
    );

    return securityTransaction;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async deleteUserAssetSecurityTransaction(
    assetId: UserAsset["id"],
    assetSecurityId: string,
    transactionId: string
  ): Promise<{
    success: boolean;
    id: string;
  }> {
    const accountId = getUserAccountId();

    if (!accountId) {
      throw new Error("Account ID not found");
    }

    const [result] = await this.db
      .delete(securityTransactions)
      .where(
        and(
          eq(securityTransactions.assetSecurityId, assetSecurityId),
          eq(securityTransactions.id, transactionId)
        )
      )
      .returning();

    if (result == null) {
      throw new Error("Failed to delete user asset security transaction");
    }

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      accountId,
      assetId,
      result.valueDate
    );

    return {
      success: result != null,
      id: result?.id,
    };
  }

  async getCombinedAssetTransactionsWithBoundariesForUserAccount(
    userAccountId: UserAccount["id"],
    query?: QueryParams
  ): Promise<WithAssetHistory<UserAsset, BrandedAbstractTransactionValue>[]> {
    const assets = await this.getUserAssets(userAccountId, query ?? {});

    //TODO This could be a direct DB query rather than a loop

    return Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        history: await this.getCombinedAssetTransactionsWithBoundariesForAsset(
          asset.id,
          query
        ),
      }))
    );
  }

  async getCombinedAssetTransactionsWithBoundariesForAsset(
    assetId: UserAsset["id"],
    query?: QueryParams
  ): Promise<BrandedAbstractTransactionValue[]> {
    const { start, end } = queryParamsFilterToDateRange(query?.filter);
    const startDate = resolveDate(start);
    const endDate = resolveDate(end);

    if (startDate && endDate) {
      if (startDate > endDate) {
        throw new Error("Start date must be before end date");
      }
    }

    const asset = await this.db.query.userAssets.findFirst({
      where: eq(userAssets.id, assetId),
      with: {
        securities: true,
      },
    });

    if (!asset) {
      throw new Error("Asset not found");
    }

    const transactions: BrandedAbstractTransactionValue[] = [];

    const select = {
      ...getTableColumns(assetTransactions),
      assetId: assetTransactions.assetId,
      recordType: sql<Extract<ValueAbstractType, "transaction">>`'transaction'`,
      transactionType: sql<TransactionType>`'asset'`,
      id: assetTransactions.id,
      value: assetTransactions.value,
      currencyValue: assetTransactions.currencyValue,
      accumulativeAssetValue: sql<DecimalValueString>`cast(sum(${assetTransactions.value}) over (partition by ${assetTransactions.assetId} order by ${assetTransactions.valueDate} rows unbounded preceding) as decimal(18, 2)  )`,
      accumulativeAssetCurrencyValue: sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${assetTransactions.assetId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`,
      accumulativeAssetCurrencyValueRow: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${assetTransactions.assetId} ORDER BY at.value_date)`,
    };

    const assetTransactionHistoryMainQuery = this.db
      .select(select)
      .from(assetTransactions)
      .where(
        and(
          eq(assetTransactions.assetId, assetId),
          startDate != null && endDate != null
            ? between(assetTransactions.valueDate, startDate, endDate)
            : startDate != null
            ? gte(assetTransactions.valueDate, startDate)
            : endDate != null
            ? lte(assetTransactions.valueDate, endDate)
            : undefined
        )
      );

    const assetTransactionHistoryBeforeQuery = this.db
      .select(select)
      .from(assetTransactions)
      .where(
        startDate
          ? and(
              eq(assetTransactions.assetId, assetId),
              lt(assetTransactions.valueDate, startDate)
            )
          : and(eq(assetTransactions.assetId, assetId))
      )
      .orderBy(desc(assetTransactions.valueDate))
      .limit(1);

    const assetTransactionHistoryAfterQuery = this.db
      .select(select)
      .from(assetTransactions)
      .where(
        endDate
          ? and(
              eq(assetTransactions.assetId, assetId),
              gt(assetTransactions.valueDate, endDate)
            )
          : and(eq(assetTransactions.assetId, assetId))
      )
      .orderBy(asc(assetTransactions.valueDate))
      .limit(1);

    // const allAssetTransactionsData =
    //   startDate && endDate
    //     ? await unionAll(
    //         assetTransactionHistoryMainQuery,
    //         assetTransactionHistoryBeforeQuery,
    //         assetTransactionHistoryAfterQuery
    //       ).orderBy(asc(assetValues.valueDate))
    //     : startDate
    //     ? await unionAll(
    //         assetTransactionHistoryMainQuery,
    //         assetTransactionHistoryBeforeQuery
    //       ).orderBy(asc(assetValues.valueDate))
    //     : endDate
    //     ? await unionAll(
    //         assetTransactionHistoryMainQuery,
    //         assetTransactionHistoryAfterQuery
    //       ).orderBy(asc(assetValues.valueDate))
    //     : await assetTransactionHistoryMainQuery.orderBy(
    //         asc(assetValues.valueDate)
    //       );

    // transactions.push(...allAssetTransactionsData);

    // const sums = this.db
    //   .select({
    //     assetId: userAssetSecurities.userAssetId,
    //     assetSecurityId: userAssetSecurities.id,
    //     accumulativeSecurityCurrencyValue:
    //       sql<number>`sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding)`.as(
    //         "accumulativeSecurityCurrencyValue"
    //       ),
    //     accumulativeSecurityCurrencyValueRow:
    //       sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.id} ORDER BY ${securityTransactions.valueDate})`.as(
    //         "accumulativeSecurityCurrencyValueRow"
    //       ),
    //     accumulativeAssetCurrencyValue:
    //       sql<number>`sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.userAssetId} order by ${securityTransactions.valueDate} rows unbounded preceding)`.as(
    //         "accumulativeAssetCurrencyValue"
    //       ),
    //     accumulativeAssetCurrencyValueRow:
    //       sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.userAssetId} ORDER BY ${securityTransactions.valueDate})`.as(
    //         "accumulativeAssetCurrencyValueRow"
    //       ),
    //   })
    //   .from(userAssetSecurities)
    //   .innerJoin(
    //     securityTransactions,
    //     eq(securityTransactions.assetSecurityId, userAssetSecurities.id)
    //   );

    const transactionsAccumulated = this.db.$with("transactionsAccumulated").as(
      this.db
        .select({
          ...getTableColumns(securityTransactions),
          //We can not use this it must be the asset id
          //not the asset function parameter because we are obtaining
          //all the securities for in this CTE for the sums.
          //and then the use of this CTE is filtered with WHERE clauses.
          //assetId: sql<string>`${assetId}`.as("assetId"),
          assetId: userAssetSecurities.userAssetId,
          assetSecurityId: securityTransactions.assetSecurityId,

          recordType: sql<
            Extract<ValueAbstractType, "transaction">
          >`'transaction'`.as("recordType"),
          transactionType: sql<TransactionType>`'security'`.as(
            "transactionType"
          ),
          value: securityTransactions.value,
          currencyValue: securityTransactions.currencyValue,
          accumalitiveSecurityValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.value}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`.as(
              "accumalitiveSecurityValue"
            ),
          accumulativeSecurityCurrencyValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.id} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`.as(
              "accumulativeSecurityCurrencyValue"
            ),
          accumulativeSecurityCurrencyValueRow:
            sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.id} ORDER BY ${securityTransactions.valueDate})`.as(
              "accumulativeSecurityCurrencyValueRow"
            ),
          // accumalitiveAssetValue:
          //   sql<number>`sum(${securityTransactions.value}) over (partition by ${userAssetSecurities.userAssetId} order by ${securityTransactions.valueDate} rows unbounded preceding)`.as(
          //     "accumalitiveAseeValue"
          //   ),
          accumulativeAssetCurrencyValue:
            sql<DecimalValueString>`cast(sum(${securityTransactions.currencyValue}) over (partition by ${userAssetSecurities.userAssetId} order by ${securityTransactions.valueDate} rows unbounded preceding) as decimal(18, 2))`.as(
              "accumulativeAssetCurrencyValue"
            ),
          accumulativeAssetCurrencyValueRow:
            sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userAssetSecurities.userAssetId} ORDER BY ${securityTransactions.valueDate})`.as(
              "accumulativeAssetCurrencyValueRow"
            ),
          beforeRange:
            sql<boolean>`${securityTransactions.valueDate} < ${startDate}`.as(
              "inRange"
            ),
          afterRange:
            sql<boolean>`${securityTransactions.valueDate} > ${endDate}`.as(
              "afterRange"
            ),
        })
        .from(userAssetSecurities)
        .innerJoin(
          securityTransactions,
          eq(securityTransactions.assetSecurityId, userAssetSecurities.id)
        )
        //.where(eq(userAssetSecurities.userAssetId, assetId))
        //This should help performance of the sums because teh
        .orderBy(
          asc(userAssetSecurities.userAssetId),
          asc(userAssetSecurities.id)
        )
    );

    const securityTransactionHistoryMainQuery = this.db
      .with(transactionsAccumulated)
      .select()
      .from(transactionsAccumulated)
      .where(
        and(
          eq(transactionsAccumulated.assetId, assetId),
          //between(securityTransactions.valueDate, startDate!, endDate!)
          startDate != null && endDate != null
            ? between(transactionsAccumulated.valueDate, startDate, endDate)
            : startDate != null
            ? gte(transactionsAccumulated.valueDate, startDate)
            : endDate != null
            ? lte(transactionsAccumulated.valueDate, endDate)
            : undefined
        )
      );
    //.innerJoin(sums, eq(transactionsAccumulated.assetSecurityId, sums.assetSecurityId));

    const securityTransactionHistoryBeforeQuery = this.db
      .with(transactionsAccumulated)
      .select()
      .from(transactionsAccumulated)
      .where(
        startDate
          ? and(
              eq(transactionsAccumulated.assetId, assetId),
              lt(transactionsAccumulated.valueDate, startDate)
            )
          : and(eq(transactionsAccumulated.assetId, assetId))
      )
      .orderBy(
        desc(transactionsAccumulated.valueDate),
        desc(transactionsAccumulated.accumulativeAssetCurrencyValueRow)
      )
      .limit(1);

    const securityTransactionHistoryAfterQuery = this.db
      .with(transactionsAccumulated)
      .select()
      .from(transactionsAccumulated)
      .where(
        endDate
          ? and(
              eq(transactionsAccumulated.assetId, assetId),
              gt(transactionsAccumulated.valueDate, endDate)
            )
          : and(eq(transactionsAccumulated.assetId, assetId))
      )
      .orderBy(
        asc(transactionsAccumulated.valueDate),
        asc(transactionsAccumulated.accumulativeAssetCurrencyValueRow)
      )
      .limit(1);

    // const allSecurityTransactionsData =
    //   await securityTransactionHistoryMainQuery.orderBy(
    //     asc(transactionsAccumulated.valueDate)
    //   );

    // const allSecurityTransactionsData =
    //   await securityTransactionHistoryBeforeQuery;

    const allSecurityTransactionsData =
      startDate && endDate
        ? await unionAll(
            securityTransactionHistoryMainQuery,
            securityTransactionHistoryBeforeQuery,
            securityTransactionHistoryAfterQuery
          ).orderBy(asc(securityTransactions.valueDate))
        : startDate
        ? await unionAll(
            securityTransactionHistoryMainQuery,
            securityTransactionHistoryBeforeQuery
          ).orderBy(asc(securityTransactions.valueDate))
        : endDate
        ? await unionAll(
            securityTransactionHistoryMainQuery,
            securityTransactionHistoryAfterQuery
          ).orderBy(asc(securityTransactions.valueDate))
        : await securityTransactionHistoryMainQuery.orderBy(
            asc(securityTransactions.valueDate)
          );

    transactions.push(...allSecurityTransactionsData);

    return transactions;
  }

  @Cached({
    namespace: "portfolio",
    keyGenerator: (userAccountId, query) =>
      buildCacheKey(
        "portfolio",
        userAccountId,
        "overview",
        queryParamsToKeyRoundedDates(query)
      ),
    //ttl: 30 * 60 * 1000, // 5 minutes
    ttl: 0, // forever
  })
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

  @Cached({
    namespace: "portfolio",
    keyGenerator: (userAccountId, query) =>
      buildCacheKey(
        "portfolio",
        userAccountId,
        "asset-value-history",
        queryParamsToKeyRoundedDates(query)
      ),
    //ttl: 30 * 60 * 1000, // 5 minutes
    ttl: 0, // forever
  })
  async getPortfolioValueHistoryForUser(
    userAccountId: UserAccount["id"],
    query?: QueryParams
  ): Promise<AssetValueTimePoint[]> {
    const assetsWithHistory =
      await this.getUserAssetsWithAssetValueHistoryWithBoundary(
        userAccountId,
        query
      );

    const valueHistory = await resolveDayValueHistoryForAssetsForDateRange(
      assetsWithHistory,
      queryParamsFilterToDateRange(query?.filter)
    );

    return valueHistory;
  }

  //The cache here will be forever.
  //It is reliant on the cache being cleared.
  @Cached({
    namespace: "portfolio",
    keyGenerator: (userAccountId, query) =>
      buildCacheKey(
        "portfolio",
        userAccountId,
        "transaction-history",
        queryParamsToKeyRoundedDates(query)
      ),
    //ttl: 30 * 60 * 1000, // 5 minutes
    ttl: 0, // forever
  })
  async getPortfolioTransactionHistoryForUser(
    userAccountId: UserAccount["id"],
    query?: QueryParams
  ): Promise<TransactionTimePoint[]> {
    const assets = await this.getUserAssets(userAccountId, query ?? {});

    const withHistory = await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        history: await this.getCombinedAssetTransactionsWithBoundariesForAsset(
          asset.id,
          query
        ),
      }))
    );

    const transactionHistory =
      await resolveDayTransactionHistoryForAssetsForDateRange(
        withHistory,
        queryParamsFilterToDateRange(query?.filter)
      );

    return transactionHistory;
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

  /**
   * Creates a group of recurring contributions distributed across multiple securities.
   * All contributions share the same groupId and are created in a single transaction.
   */
  async createRecurringContributionGroup(
    assetId: UserAsset["id"],
    data: {
      amount: DecimalValueString;
      process: "automatic" | "manual";
      startDate: Date;
      patternConfig: {
        type: "rrule" | "cron";
        expression: string;
        timezone?: string;
      };
      notificationEmail?: boolean;
      notificationPush?: boolean;
      isActive?: boolean;
      securityDistribution: Array<{
        securityId: string;
        commitment: DecimalValueString; // Percentage (0-100)
      }>;
    }
  ): Promise<RecurringContribution[]> {
    // Make sure the asset exists
    const asset = await this.getUserAsset(assetId);
    if (!asset) {
      throw new Error(`Asset with ID ${assetId} not found`);
    }

    // Validate that all securities belong to this asset
    const assetSecurities = await this.db.query.userAssetSecurities.findMany({
      where: eq(userAssetSecurities.userAssetId, assetId),
    });

    const assetSecurityIds = new Set(assetSecurities.map((s) => s.id));
    for (const dist of data.securityDistribution) {
      if (!assetSecurityIds.has(dist.securityId)) {
        throw new Error(
          `Security ${dist.securityId} does not belong to asset ${assetId}`
        );
      }
    }

    // Generate a shared groupId for all contributions
    const groupId = crypto.randomUUID();

    // Calculate total commitment to validate it sums to 100
    const totalCommitment = data.securityDistribution.reduce(
      (sum, dist) => sum + Number(dist.commitment),
      0
    );

    // Create all contributions in a transaction
    const insertedContributions = await this.db.transaction(async (tx) => {
      const contributions: RecurringContribution[] = [];

      for (const dist of data.securityDistribution) {
        // Calculate the amount for this security based on its commitment percentage
        const securityAmount = createDecimalValueString(
          (
            (Number(data.amount) * Number(dist.commitment)) /
            totalCommitment
          ).toFixed(2)
        );

        const [inserted] = await tx
          .insert(recurringContributions)
          .values({
            assetId,
            securityId: dist.securityId,
            groupId,
            type: "security",
            amount: securityAmount,
            process: data.process,
            startDate: data.startDate,
            patternConfig: data.patternConfig,
            notificationEmail: data.notificationEmail ?? false,
            notificationPush: data.notificationPush ?? false,
            isActive: data.isActive ?? true,
          })
          .returning();

        if (inserted) {
          contributions.push(inserted);
        }
      }

      return contributions;
    });

    return insertedContributions;
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
        contribution.patternConfig
      );

      // Check if the next processing date is due
      if (nextDate <= now) {
        // Create a contribution (debit) entry
        await this.createUserAssetTransaction(contribution.assetId, {
          value: contribution.amount,
          valueDate: new Date(),
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
      orderBy: orderBy || [desc(userAssetSecurities.createdAt)],
      limit,
      offset,
    });
  }

  async getUserAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"]
  ): Promise<ResolvedAssetSecurity> {
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
    return security as ResolvedAssetSecurity;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async createUserAssetSecurity(
    assetId: UserAsset["id"],
    data: UserAssetSecurityOrphanCreate,
    tx?: Transaction
  ): Promise<UserAssetSecuritySelect> {
    // Make sure the asset exists

    const exec = async (
      tx: Transaction
    ): Promise<{
      asset: UserAsset;
      value: UserAssetSecuritySelect;
      transaction: SecurityTransaction;
    }> => {
      /**
       * We must use the transactions here and not the internal getUserAsset method.
       * Maybe later the getUserAsset could also use the transactions.
       * We have to use the transaction here because this function may have been called\
       * as a sub process to createUserAsset and therefor the created user asset
       * is a part of the transaction and not yet committed.
       */
      const asset = await tx.query.userAssets.findFirst({
        where: eq(userAssets.id, assetId),
      });

      if (!asset) {
        throw new Error(`User asset with ID ${assetId} not found`);
      }

      const securityId =
        data.type === "new"
          ? await (async () => {
              const security =
                await securitiesService.createOrFindCachedSecurity(
                  data.security
                );
              if (!security) {
                throw new Error(
                  `Security with ID ${data.security.name} not found`
                );
              }
              return security.id;
            })()
          : data.securityId;

      const values: UserAssetSecurityLinkInsert = {
        userAssetId: assetId,
        securityId: securityId,
        startDate: data.startDate,
        priorGainLoss: data.priorGainLoss,
      };

      const [insertedValueItem] = await tx
        .insert(userAssetSecurities)
        .values(values)
        .returning();

      const value = await tx.query.userAssetSecurities.findFirst({
        where: and(
          eq(userAssetSecurities.userAssetId, assetId),
          eq(userAssetSecurities.securityId, securityId)
        ),
        with: { security: true },
      });

      if (!value) {
        throw new Error("Failed to create user asset security");
      }

      const [transaction] = await tx
        .insert(securityTransactions)
        .values({
          assetSecurityId: value.id,
          value: data.initialHolding.shareHolding,
          currency: value.security.currency ?? "GBP",
          currencyValue: data.initialHolding.currencyValue,
          recordedAt: new Date(),
          valueDate: data.startDate,
        })
        .returning();

      if (!transaction) {
        tx.rollback();
        throw new Error("Failed to create security transaction");
      }

      return { asset, value, transaction };
      //});
    };

    const { value } = tx
      ? await exec(tx)
      : await this.db.transaction(async (tx) => exec(tx));

    return value;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async createUserAssetSecurityAndTriggerUpdates(
    assetId: UserAsset["id"],
    data: UserAssetSecurityOrphanCreate,
    tx?: Transaction
  ): Promise<UserAssetSecuritySelect> {
    console.log(
      "Creating user asset security and triggering updates for assetId",
      assetId
    );

    const userAccountId = getUserAccountId();

    const value = await this.createUserAssetSecurity(assetId, data, tx);
    //TODO needs async local
    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      userAccountId,
      assetId,
      data.startDate
    );
    return value;
  }

  async updateUserAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"],
    data: UserAssetSecurityOrphanLinkInsert
  ): Promise<UserAssetSecuritySelect> {
    const userAccountId = getUserAccountId();
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

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      userAccountId,
      assetId,
      data.startDate
    );

    return value;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async deleteUserAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"]
  ): Promise<boolean> {
    const userAccountId = getUserAccountId();

    if (!userAccountId) {
      throw new Error("Account ID not found");
    }

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

    this.assetValuesService.updateAssetValuesForAssetOfAccount(
      userAccountId,
      assetId,
      new Date()
    );

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
          currencyValue: sum(securityTransactions.currencyValue),
        })
        .from(userAssetSecurities)
        .innerJoin(
          securityTransactions,
          eq(userAssetSecurities.id, securityTransactions.assetSecurityId)
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
      currencyValue: Number(r.currencyValue ?? 0),
    }));
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async removeAssetValuesFromDate(
    assetId: UserAsset["id"],
    date: Date
  ): Promise<void> {
    await this.db
      .delete(assetValues)
      .where(
        and(eq(assetValues.assetId, assetId), gte(assetValues.valueDate, date))
      );
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
  removeAssetValuesFromDate: (date: Date) => Promise<void>;
};

export type AssetSecurityShareHoldingsForDate = {
  securityId: string;
  shareHolding: number;
  currencyValue: number;
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

    removeAssetValuesFromDate: async (date: Date): Promise<void> => {
      return service.removeAssetValuesFromDate(assetId, date);
    },
  };
};


/// Legacy kept for reference

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
