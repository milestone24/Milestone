import {
  assetValues,
  brokerPlatforms,
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
  min,
  not,
  sql,
  sum,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import {
  UserAsset,
  AssetTransaction,
  AssetValue,
  BrokerProvider,
  UserAccount,
  ValueChange,
  UserAssetValueOrphanInsert,
  RecurringContribution,
  RecurringContributionOrphanInsert,
  WithAssetHistory,
  DataRangeQuery,
  UserAssetSecuritySelect,
  ResolvedAssetSecurity,
  BrokerPlatform,
  UserAssetInsert,
  UserAssetTransactionOrphanInsert,
  ResolvedUserAsset,
  AssetValueTimePoint,
  SecurityTransactionOrphanInsert,
  SecurityTransaction,
  TransactionTimePoint,
  ValueAbstractType,
  BrandedAssetValue,
  BrandedAssetTransactionValue,
  BrandedUserAssetSecurityTransactionResolved,
  BrandedAbstractTransactionValue,
  TransactionType,
  UserAssetWithValue,
  createDecimalValueString,
  DecimalValueString,
  UserAssetSecurityLinkInsert,
  UserAssetSecurityOrphanCreate,
  UserAssetSecurityOrphanLinkInsert,
  UserAssetWithValueChange,
  PortfolioValue,
  UserAssetUpdate,
  BrokerPlatformInUseItem,
  PortfolioRangeReturns,
  TransactionBundleInsert,
  TransactionBundleResponse,
} from "@shared/schema";
import {
  computePortfolioRangeReturns,
  mapDecimalToNullableDecimalString,
} from "@shared/utils/portfolio-returns-range";
import type { PortfolioReturnsMwrCashFlow } from "@shared/utils/portfolio-returns-mwr";
import {
  QueryParams,
  ResourceQueryBuilder,
} from "@server/utils/resource-query-builder";
import {
  resolveAssetsWithChange,
  resolveDate,
  getPortfolioOverviewForAssets,
  resolveDayValueHistoryForAssetsForDateRange,
  queryParamsFilterToDateRange,
  resolveDayTransactionHistoryForAssetsForDateRange,
} from "@shared/utils/assets";
import { factory as securitiesFactory } from "@server/services/securities";
import { AssetSecurity } from "../securities/types";
import { mapDbSecurityToSelect } from "@server/utils/securities";
import { getNextExecutionDate } from "@shared/utils/scheduling";
import { randomUUID } from "node:crypto";
import {
  assetTransactionsAccumulatedCte,
  calculatedAssetsQueryBuilder,
  securityTransactionsAccumulatedCTEBuilder,
} from "./query";
import Decimal from "decimal.js";
import { getUserAccountId } from "@server/auth";
import { AssetValuesService } from "../process/asset-values";
import {
  Cached,
  buildCacheKey,
  InvalidatesCache,
  queryParamsToKeyRoundedDates,
  dataRangeQueryToKey,
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

/**
 * Inclusive end of the UTC calendar day for `d` (e.g. cash booked on that day in UTC).
 */
export function endOfUtcDayForAssetValue(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

export class DatabaseAssetService {
  private assetValuesService: AssetValuesService;
  constructor(private db: Database) {
    this.assetValuesService = new AssetValuesService(db);
  }

  /**
   * Sum of `asset_transactions.currency_value` for the asset, optionally through `onOrBeforeInclusive`.
   * Pass `null` for no end bound (all rows). `fromDb` supports running inside a transaction.
   */
  async getAssetCashBalanceOnOrBefore(
    assetId: string,
    onOrBeforeInclusive: Date | null,
    fromDb: Database = this.db
  ): Promise<Decimal> {
    const wh = onOrBeforeInclusive
      ? and(
          eq(assetTransactions.assetId, assetId),
          lte(assetTransactions.valueDate, onOrBeforeInclusive)
        )
      : eq(assetTransactions.assetId, assetId);
    const [row] = await fromDb
      .select({
        total: sql<string>`coalesce(sum(${assetTransactions.currencyValue}), 0)`,
      })
      .from(assetTransactions)
      .where(wh);
    return new Decimal(row?.total ?? "0");
  }

  async getUserAssets(
    userId: UserAccount["id"],
    query: QueryParams
  ): Promise<UserAsset[]> {
    const { where, orderBy, limit, offset } =
      userAssetsQueryBuilder.buildQuery(query);
    // TODO: the securities join here is wasteful — UserAsset[] does not expose securities
    // in its return type so the fetched data is unused. Consider removing the join.
    const brokerAssets = await this.db.query.userAssets.findMany({
      with: { provider: true, securities: { with: { security: true } } },
      where: and(eq(userAssets.userAccountId, userId), where),
      orderBy,
      limit,
      offset,
    });
    return brokerAssets;
  }

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

    if (!endResolved) {
      throw new Error(
        "getUserAssetsWithBoundaryCandidates requires an end date for change calculation"
      );
    }

    // For "Max" range (no start), resolve the earliest recorded value date
    // across all assets in a single query and use it as the shared start.
    let resolvedStart = startResolved;
    if (!resolvedStart && assets.length > 0) {
      const assetIds = assets.map((a) => a.id);
      const [earliest] = await this.db
        .select({ date: min(assetValues.valueDate) })
        .from(assetValues)
        .where(inArray(assetValues.assetId, assetIds));

      resolvedStart = earliest?.date ?? null;
    }

    if (!resolvedStart) {
      return assets.map((asset) => ({ ...asset, history: [] }));
    }

    return await Promise.all(
      assets.map(async (asset) => {
        const candidates = await this.getUserAssetWithBoundaryCandidates(
          asset.id,
          resolvedStart,
          endResolved
        );

        return { ...asset, history: candidates };
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

  async getBrokerPlatformsInUseForUserAccount(
    userAccountId: UserAccount["id"]
  ): Promise<BrokerPlatformInUseItem[]> {
    return this.db
      .select({
        id: brokerPlatforms.id,
        name: brokerPlatforms.name,
      })
      .from(brokerPlatforms)
      .innerJoin(userAssets, eq(userAssets.platformId, brokerPlatforms.id))
      .where(eq(userAssets.userAccountId, userAccountId))
      .groupBy(brokerPlatforms.id, brokerPlatforms.name)
      .orderBy(asc(brokerPlatforms.name));
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

        let currentValue: DecimalValueString =
          latestValue?.value ?? createDecimalValueString("0");
        if (userAsset.valueMethod === "calculated") {
          const cash = await this.getAssetCashBalanceOnOrBefore(
            id,
            latestValue?.valueDate ?? null,
            tx
          );
          currentValue = createDecimalValueString(
            new Decimal(latestValue?.value ?? "0").add(cash).toString()
          );
        }

        return {
          ...userAsset,
          currentValue,
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
          security: mapDbSecurityToSelect(security.security),
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

  @Cached({
    namespace: "assets",
    keyGenerator: (id, query) =>
      buildCacheKey(
        "assets",
        getUserAccountId(),
        id,
        "value-history-graph",
        dataRangeQueryToKey(query)
      ),
    ttl: 0,
  })
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
  }

  @Cached({
    namespace: "assets",
    keyGenerator: (id, query) =>
      buildCacheKey(
        "assets",
        getUserAccountId(),
        id,
        "transaction-history-graph",
        queryParamsToKeyRoundedDates(query)
      ),
    ttl: 0,
  })
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
          source: "manual",
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

    // this.assetValuesService.updateAssetValuesForAssetOfAccount(
    //   insertedUserAsset.userAccountId,
    //   insertedUserAsset.id
    // );

    this.assetValuesService.initAssetValuesForAssetOfAccount(
      insertedUserAsset.userAccountId,
      insertedUserAsset.id
    );

    return insertedUserAsset;
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async updateUserAsset(
    id: UserAsset["id"],
    data: UserAssetUpdate
  ): Promise<UserAsset> {

    const updatedUserAsset = await this.db.transaction(async (tx) => {

      try {

        const userAsset = await tx.query.userAssets.findFirst({
          where: eq(userAssets.id, id),
          columns: {
            startDate: true,
          },
        });

        if (!userAsset) {
          throw new Error("User asset not found");
        }

        const assetStartDate = userAsset.startDate;

        const [updatedUserAsset] = await tx
          .update(userAssets)
          .set(data)
          .where(eq(userAssets.id, id))
          .returning();

        //First update the asset securities start dates if start dates match
        //Do we need an extra field on the asset securities table to track 
        //if the start date is aligned?
        //The securities start date is changed alignment should be false

        if (data.startDate) {

          const userAssetSecuritiesForAsset = await tx.query.userAssetSecurities.findMany({
            where: eq(userAssetSecurities.userAssetId, id),
            columns: {
              id: true,
              startDate: true,
            },
          });

          if (userAssetSecuritiesForAsset.length > 0) {

            const userAssetSecuritiesIds = userAssetSecuritiesForAsset.map((security) => security.id);

            /*
            First we obtain a list of security transactions that are before the new start date,
            an not equal to the new asset start date.
            */

            const securitiesTransactionsBeforeStartDate = await tx.query.securityTransactions.findMany({
              where: and(
                inArray(securityTransactions.assetSecurityId, userAssetSecuritiesIds),
                not(eq(securityTransactions.valueDate, assetStartDate)),
                lt(securityTransactions.valueDate, data.startDate)),
              columns: {
                id: true,
                valueDate: true,
              },
            });

            /*
            If there are security transactions before the new start date, we need to throw an error
            because we can not update the start date of the asset securities if there are security transactions
            before the new start date.
            */

            if (securitiesTransactionsBeforeStartDate.length > 0) {
              throw new Error("Security transactions before new start date found");
            }

            const updatedUserAssetSecurities = await tx.update(userAssetSecurities).set({
              startDate: data.startDate,
            }).where(
              and(
                eq(userAssetSecurities.userAssetId, id),
                eq(userAssetSecurities.startDate, assetStartDate)
              )
            ).returning();

            const securityTransactionIds = updatedUserAssetSecurities.map((security) => security.id);

            if (updatedUserAssetSecurities.length > 0) {
              await tx.update(securityTransactions).set({
                valueDate: data.startDate,
              }).where(
                and(
                  inArray(securityTransactions.assetSecurityId, securityTransactionIds),
                  eq(securityTransactions.valueDate, assetStartDate)
                )
              ).returning();
            }
          }
        }

        return updatedUserAsset;

      } catch (error) {
        /*
        We dont need to rollback here because the error thrown
        will cause the transaction to be rolled back automatically.
        */
        //await tx.rollback();
        const errorMessage = error instanceof Error ? error.message : undefined;
        throw new Error(`Failed to update user asset${(errorMessage ? `: ${errorMessage}` : ".")}`);
      }

    });

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
        source: data.source ?? "manual",
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
        source: data.source ?? "manual",
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
  async createTransactionBundle(
    assetId: UserAsset["id"],
    data: TransactionBundleInsert
  ) {
    const assetSecurity = await this.db.query.userAssetSecurities.findFirst({
      where: and(
        eq(userAssetSecurities.id, data.securityLeg.assetSecurityId),
        eq(userAssetSecurities.userAssetId, assetId)
      ),
      columns: { id: true },
    });

    if (!assetSecurity) {
      throw new Error("Security not found for this asset");
    }

    const ledgerGroupId = randomUUID();

    return this.db.transaction(async (tx) => {
      const [securityLeg] = await tx
        .insert(securityTransactions)
        .values({
          ...data.securityLeg,
          ledgerGroupId,
          recordedAt: data.securityLeg.recordedAt ?? new Date(),
          source: data.securityLeg.source ?? "manual",
        })
        .returning();

      if (!securityLeg) {
        throw new Error("Failed to insert security leg");
      }

      if (!data.cashLeg) {
        return { groupId: ledgerGroupId, securityLeg };
      }

      const [cashLeg] = await tx
        .insert(assetTransactions)
        .values({
          ...data.cashLeg,
          assetId,
          ledgerGroupId,
          recordedAt: new Date(),
          source: data.cashLeg.source ?? "manual",
        })
        .returning();

      if (!cashLeg) {
        throw new Error("Failed to insert cash leg");
      }

      return { groupId: ledgerGroupId, securityLeg, cashLeg };
    });
  }

  @InvalidatesCache({ namespaces: ["portfolio", "assets"], scope: "account" })
  async deleteTransactionBundle(
    assetId: UserAsset["id"],
    groupId: string
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(securityTransactions).where(
        and(
          eq(securityTransactions.ledgerGroupId, groupId),
          inArray(
            securityTransactions.assetSecurityId,
            tx
              .select({ id: userAssetSecurities.id })
              .from(userAssetSecurities)
              .where(eq(userAssetSecurities.userAssetId, assetId))
          )
        )
      );

      await tx.delete(assetTransactions).where(
        and(
          eq(assetTransactions.ledgerGroupId, groupId),
          eq(assetTransactions.assetId, assetId)
        )
      );
    });
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

  /**
   * Merged security + asset transaction rows for UI lists: **only** rows in the requested date window
   * (or all rows when unfiltered). Does **not** prepend/append boundary rows outside the window —
   * those exist for chart / portfolio aggregation in
   * {@link getCombinedAssetTransactionsWithBoundariesForAsset}.
   */
  @Cached({
    namespace: "assets",
    keyGenerator: (id, query) =>
      buildCacheKey(
        "assets",
        getUserAccountId(),
        id,
        "flat-transaction-events",
        queryParamsToKeyRoundedDates(query)
      ),
    ttl: 0,
  })
  async getFlatCombinedAssetTransactionsForAsset(
    assetId: UserAsset["id"],
    query?: QueryParams
  ): Promise<BrandedAbstractTransactionValue[]> {
    return this.getCombinedAssetTransactionRowsForAsset(
      assetId,
      query,
      false
    );
  }

  async getCombinedAssetTransactionsWithBoundariesForAsset(
    assetId: UserAsset["id"],
    query?: QueryParams
  ): Promise<BrandedAbstractTransactionValue[]> {
    return this.getCombinedAssetTransactionRowsForAsset(assetId, query, true);
  }

  private async getCombinedAssetTransactionRowsForAsset(
    assetId: UserAsset["id"],
    query: QueryParams | undefined,
    includeRangeBoundaryRows: boolean
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
          groupId: securityTransactions.ledgerGroupId,
        })
        .from(userAssetSecurities)
        .innerJoin(
          securityTransactions,
          eq(securityTransactions.assetSecurityId, userAssetSecurities.id)
        )
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
          startDate != null && endDate != null
            ? between(transactionsAccumulated.valueDate, startDate, endDate)
            : startDate != null
            ? gte(transactionsAccumulated.valueDate, startDate)
            : endDate != null
            ? lte(transactionsAccumulated.valueDate, endDate)
            : undefined
        )
      );

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

    const allSecurityTransactionsData = includeRangeBoundaryRows
      ? startDate && endDate
        ? await unionAll(
            securityTransactionHistoryMainQuery,
            securityTransactionHistoryBeforeQuery,
            securityTransactionHistoryAfterQuery
          ).orderBy(asc(transactionsAccumulated.valueDate))
        : startDate
        ? await unionAll(
            securityTransactionHistoryMainQuery,
            securityTransactionHistoryBeforeQuery
          ).orderBy(asc(transactionsAccumulated.valueDate))
        : endDate
        ? await unionAll(
            securityTransactionHistoryMainQuery,
            securityTransactionHistoryAfterQuery
          ).orderBy(asc(transactionsAccumulated.valueDate))
        : await securityTransactionHistoryMainQuery.orderBy(
            asc(transactionsAccumulated.valueDate)
          )
      : await securityTransactionHistoryMainQuery.orderBy(
          asc(transactionsAccumulated.valueDate)
        );

    const assetTransactionsAccumulated = assetTransactionsAccumulatedCte(
      this.db,
      startDate,
      endDate
    );

    const assetTransactionHistoryMainQuery = this.db
      .with(assetTransactionsAccumulated)
      .select()
      .from(assetTransactionsAccumulated)
      .where(
        and(
          eq(assetTransactionsAccumulated.assetId, assetId),
          startDate != null && endDate != null
            ? between(
                assetTransactionsAccumulated.valueDate,
                startDate,
                endDate
              )
            : startDate != null
            ? gte(assetTransactionsAccumulated.valueDate, startDate)
            : endDate != null
            ? lte(assetTransactionsAccumulated.valueDate, endDate)
            : undefined
        )
      );

    const assetTransactionHistoryBeforeQuery = this.db
      .with(assetTransactionsAccumulated)
      .select()
      .from(assetTransactionsAccumulated)
      .where(
        startDate
          ? and(
              eq(assetTransactionsAccumulated.assetId, assetId),
              lt(assetTransactionsAccumulated.valueDate, startDate)
            )
          : and(eq(assetTransactionsAccumulated.assetId, assetId))
      )
      .orderBy(
        desc(assetTransactionsAccumulated.valueDate),
        desc(assetTransactionsAccumulated.accumulativeAssetCurrencyValueRow)
      )
      .limit(1);

    const assetTransactionHistoryAfterQuery = this.db
      .with(assetTransactionsAccumulated)
      .select()
      .from(assetTransactionsAccumulated)
      .where(
        endDate
          ? and(
              eq(assetTransactionsAccumulated.assetId, assetId),
              gt(assetTransactionsAccumulated.valueDate, endDate)
            )
          : and(eq(assetTransactionsAccumulated.assetId, assetId))
      )
      .orderBy(
        asc(assetTransactionsAccumulated.valueDate),
        asc(assetTransactionsAccumulated.accumulativeAssetCurrencyValueRow)
      )
      .limit(1);

    const allAssetTransactionsData = includeRangeBoundaryRows
      ? startDate && endDate
        ? await unionAll(
            assetTransactionHistoryMainQuery,
            assetTransactionHistoryBeforeQuery,
            assetTransactionHistoryAfterQuery
          ).orderBy(asc(assetTransactionsAccumulated.valueDate))
        : startDate
        ? await unionAll(
            assetTransactionHistoryMainQuery,
            assetTransactionHistoryBeforeQuery
          ).orderBy(asc(assetTransactionsAccumulated.valueDate))
        : endDate
        ? await unionAll(
            assetTransactionHistoryMainQuery,
            assetTransactionHistoryAfterQuery
          ).orderBy(asc(assetTransactionsAccumulated.valueDate))
        : await assetTransactionHistoryMainQuery.orderBy(
            asc(assetTransactionsAccumulated.valueDate)
          )
      : await assetTransactionHistoryMainQuery.orderBy(
          asc(assetTransactionsAccumulated.valueDate)
        );

    const combined = [
      ...allSecurityTransactionsData,
      ...allAssetTransactionsData,
    ].sort((a, b) => {
      const ad =
        a.valueDate instanceof Date
          ? a.valueDate
          : new Date(String(a.valueDate));
      const bd =
        b.valueDate instanceof Date
          ? b.valueDate
          : new Date(String(b.valueDate));
      const t = ad.getTime() - bd.getTime();
      if (t !== 0) {
        return t;
      }
      return a.id.localeCompare(b.id);
    });

    transactions.push(...(combined as BrandedAbstractTransactionValue[]));

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
  ): Promise<ValueChange> {

    const assetsWithChange = await this.getUserAssetsWithAccountValueChange(
      userAccountId,
      query
    );

    const change = await getPortfolioOverviewForAssets(assetsWithChange);

    return change;
  }

  @Cached({
    namespace: "portfolio",
    keyGenerator: (userAccountId) =>
      buildCacheKey(
        "portfolio",
        userAccountId,
        "values",
        queryParamsToKeyRoundedDates({
          filter: {
            dateRange: {
              start: new Date(0),
              end: new Date(),
            },
          },
        })
      ),
    //ttl: 30 * 60 * 1000, // 5 minutes
    ttl: 0, // forever
  })
  async getPortfolioValueForUser(
    userAccountId: UserAccount["id"],
  ): Promise<PortfolioValue> {

    const assets = await calculatedAssetsQueryBuilder(this.db)
      .where(and(eq(userAssets.userAccountId, userAccountId)))
      .execute();

    //First get the sum of the last values for all assets.

    const assetIds = assets.map((asset) => asset.id);

    const value = assets
    .map((asset) => Decimal(asset.currentValue))
    .reduce((acc:Decimal, curr:Decimal) => acc.add(curr), Decimal(0))
    .toFixed(2);

    //Then get the sum of all transactions to date for all assets.

    const transactionsAccumulated = securityTransactionsAccumulatedCTEBuilder(this.db);

    const avs = await this.db.with(transactionsAccumulated)
    .selectDistinctOn([transactionsAccumulated.assetId])
    .from(transactionsAccumulated)
    .where(inArray(transactionsAccumulated.assetId, assetIds))
    .orderBy(
      asc(transactionsAccumulated.assetId),
      desc(transactionsAccumulated.valueDate)
    )

    const values = avs.map((av) => Decimal(av.accumulativeAssetCurrencyValue));

    const assetsTransactionsValue = values.reduce((acc, curr) => acc.add(curr), Decimal(0));

    const returnValue = Decimal(value).div(assetsTransactionsValue).mul(100).toFixed(2);

    return {
      value: createDecimalValueString(value.toString()),
      returnValue: createDecimalValueString(returnValue.toString()),
    };
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

  /**
   * `asset_transaction.currency_value` for all user assets, for Modified Dietz / TWR cash-flow inputs
   * (external bank ↔ account, per product docs). Timestamps preserved for GIPS day-weighting.
   */
  async getUserAccountAssetTransactionCurrencyFlows(
    userAccountId: UserAccount["id"],
    range: { start: Date; end: Date }
  ): Promise<PortfolioReturnsMwrCashFlow[]> {
    const wh = [
      eq(userAssets.userAccountId, userAccountId),
      gte(assetTransactions.valueDate, range.start),
      lte(assetTransactions.valueDate, range.end),
    ];
    const rows = await this.db
      .select({
        valueDate: assetTransactions.valueDate,
        currencyValue: assetTransactions.currencyValue,
      })
      .from(assetTransactions)
      .innerJoin(userAssets, eq(userAssets.id, assetTransactions.assetId))
      .where(and(...wh));
    return rows.map((r) => ({
      asOf: r.valueDate,
      amount: new Decimal(r.currencyValue),
    }));
  }

  @Cached({
    namespace: "portfolio",
    keyGenerator: (userAccountId, query) =>
      buildCacheKey(
        "portfolio",
        userAccountId,
        "range-returns",
        queryParamsToKeyRoundedDates(query)
      ),
    ttl: 0,
  })
  async getPortfolioRangeReturnsForUser(
    userAccountId: UserAccount["id"],
    query?: QueryParams
  ): Promise<PortfolioRangeReturns> {
    const dr = queryParamsFilterToDateRange(query?.filter);
    const valueHistory = await this.getPortfolioValueHistoryForUser(
      userAccountId,
      query
    );

    if (valueHistory.length === 0) {
      const start = resolveDate(dr.start) ?? new Date(0);
      const end = resolveDate(dr.end) ?? new Date();
      return {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        beginningValue: null,
        endingValue: null,
        modifiedDietz: null,
        timeWeightedReturn: null,
      };
    }

    const first = valueHistory[0]!;
    const last = valueHistory[valueHistory.length - 1]!;
    const periodStart: Date = resolveDate(dr.start) ?? first.valueDate;
    const periodEnd: Date = resolveDate(dr.end) ?? last.valueDate;
    if (periodEnd.getTime() < periodStart.getTime()) {
      return {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        beginningValue: null,
        endingValue: null,
        modifiedDietz: null,
        timeWeightedReturn: null,
      };
    }

    const cashFlows = await this.getUserAccountAssetTransactionCurrencyFlows(
      userAccountId,
      { start: periodStart, end: periodEnd }
    );
    const valuePoints = valueHistory.map((p) => ({
      valueDate: p.valueDate,
      value: p.value,
    }));
    const result = computePortfolioRangeReturns({
      valuePoints,
      cashFlows,
      periodStart,
      periodEnd,
    });
    if (!result) {
      return {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        beginningValue: null,
        endingValue: null,
        modifiedDietz: null,
        timeWeightedReturn: null,
      };
    }
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      beginningValue: result.beginningValue,
      endingValue: result.endingValue,
      modifiedDietz: mapDecimalToNullableDecimalString(result.modifiedDietz),
      timeWeightedReturn: mapDecimalToNullableDecimalString(
        result.timeWeightedReturn
      ),
    };
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
          source: "recurring",
          flags: { estimated: true },
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
    const rows = await this.db.query.userAssetSecurities.findMany({
      with: { security: true },
      where: and(eq(userAssetSecurities.userAssetId, assetId), where),
      orderBy: orderBy || [desc(userAssetSecurities.createdAt)],
      limit,
      offset,
    });
    return rows.map((row) => ({ ...row, security: mapDbSecurityToSelect(row.security) }));
  }

  /**
   * Returns a single user asset security with its related security record.
   * NOTE: Returns UserAssetSecuritySelect — does NOT compute calculatedValue.
   * If calculatedValue is required, use getResolvedUserAssetSecurities instead.
   * NOTE: The corresponding GET route for this method appears currently unused on the client.
   */
  async getUserAssetSecurity(
    assetId: UserAsset["id"],
    securityId: UserAssetSecuritySelect["id"]
  ): Promise<UserAssetSecuritySelect> {
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
    return { ...security, security: mapDbSecurityToSelect(security.security) };
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

      const valueRaw = await tx.query.userAssetSecurities.findFirst({
        where: and(
          eq(userAssetSecurities.userAssetId, assetId),
          eq(userAssetSecurities.securityId, securityId)
        ),
        with: { security: true },
      });

      if (!valueRaw) {
        throw new Error("Failed to create user asset security");
      }

      const value = { ...valueRaw, security: mapDbSecurityToSelect(valueRaw.security) };

      const [transaction] = await tx
        .insert(securityTransactions)
        .values({
          assetSecurityId: value.id,
          value: data.initialHolding.shareHolding,
          currency: value.security.currency ?? "GBP",
          currencyValue: data.initialHolding.currencyValue,
          recordedAt: new Date(),
          valueDate: data.startDate,
          source: "manual",
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

      const valueRaw = await tx.query.userAssetSecurities.findFirst({
        where: and(
          eq(userAssetSecurities.id, securityId),
          eq(userAssetSecurities.userAssetId, assetId)
        ),
        with: { security: true },
      });

      return valueRaw ? { ...valueRaw, security: mapDbSecurityToSelect(valueRaw.security) } : undefined;
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

  /**
   * Creates a session-scoped temp table for staging asset values (same shape as asset_values minus id).
   * Must only be used on a single connection: all staging calls (insert, merge, clear) for this run
   * must use the same connection. Do not use the default pool db — use a connection obtained via
   * db.withConnection so each run has an exclusive connection; concurrent runs then get separate
   * connections and thus separate temp tables, with no cross-run sharing.
   */
  async createTempTableForAssetValues(): Promise<void> {
    await this.db.execute(sql`
      CREATE TEMP TABLE IF NOT EXISTS asset_values_temp (
        value decimal(18,2) not null,
        recorded_at timestamptz not null,
        value_date timestamptz not null,
        entry_method value_entry_method not null default 'manual',
        asset_id uuid not null,
        metadata jsonb,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )
    `);
  }

  /**
   * Inserts a batch of asset values into the session's temp table (for chunked updater).
   */
  async insertAssetValuesStaging(
    assetId: UserAsset["id"],
    values: AssetValueStagingInsert[]
  ): Promise<void> {
    if (values.length === 0) return;
    const now = new Date();
    for (const v of values) {
      const entryMethod = v.entryMethod ?? "calculated";
      const metadata = v.metadata ?? {};
      await this.db.execute(sql`
        INSERT INTO asset_values_temp (value, recorded_at, value_date, entry_method, asset_id, metadata, created_at, updated_at)
        VALUES (${v.value}, ${v.recordedAt}, ${v.valueDate}, ${entryMethod}, ${assetId}, ${JSON.stringify(metadata)}::jsonb, ${now}, ${now})
      `);
    }
  }

  /**
   * Merges staged values from the session's temp table into asset_values for the given range, then clears the temp table.
   * Replaces the run's date range in asset_values with the staged rows.
   */
  async mergeStagingIntoAssetValues(
    assetId: UserAsset["id"],
    runStartDate: Date,
    runEndDate: Date
  ): Promise<void> {
    await this.db
      .delete(assetValues)
      .where(
        and(
          eq(assetValues.assetId, assetId),
          gte(assetValues.valueDate, runStartDate),
          lte(assetValues.valueDate, runEndDate)
        )
      );
    await this.db.execute(sql`
      INSERT INTO asset_values (value, recorded_at, value_date, entry_method, asset_id, metadata, created_at, updated_at)
      SELECT value, recorded_at, value_date, entry_method, asset_id, metadata, created_at, updated_at
      FROM asset_values_temp
    `);
  }

  /**
   * Drops the session's temp table (no-op if not used). Call after merge or on abort when using temp table.
   */
  async clearStagingForJob(): Promise<void> {
    await this.db.execute(sql`DROP TABLE IF EXISTS asset_values_temp`);
  }
}

/* Asset Persistence Utility */

/** Staging insert shape: orphan fields plus optional entryMethod/metadata (chunked updater supplies these). */
export type AssetValueStagingInsert = UserAssetValueOrphanInsert & {
  entryMethod?: "manual" | "calculated";
  metadata?: unknown;
};

export type AssetPersistence = {
  getAssetById: () => Promise<Pick<ResolvedUserAsset, "id" | "valueMethod">>;
  getAssetCashBalanceAsOfDate: (asOf: Date) => Promise<Decimal>;
  getLastAssetValue: () => Promise<AssetValue | null>;
  getAssetSecurities: () => Promise<AssetSecurity[]>;
  getAssetSecurityShareHoldingsForDate: (
    date: Date
  ) => Promise<AssetSecurityShareHoldingsForDate[]>;
  insertAssetValues: (
    values: UserAssetValueOrphanInsert[]
  ) => Promise<AssetValue[]>;
  removeAssetValuesFromDate: (date: Date) => Promise<void>;
  createTempTableForAssetValues: () => Promise<void>;
  insertAssetValuesStaging: (values: AssetValueStagingInsert[]) => Promise<void>;
  mergeStagingIntoAssetValues: (
    runStartDate: Date,
    runEndDate: Date
  ) => Promise<void>;
  clearStagingForJob: () => Promise<void>;
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
    getAssetById: async (): Promise<
      Pick<ResolvedUserAsset, "id" | "valueMethod">
    > => {
      const a = await service.getUserAsset(assetId);
      return { id: a.id, valueMethod: a.valueMethod };
    },

    getAssetCashBalanceAsOfDate: async (asOf: Date): Promise<Decimal> => {
      return service.getAssetCashBalanceOnOrBefore(
        assetId,
        endOfUtcDayForAssetValue(asOf)
      );
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

    createTempTableForAssetValues: async (): Promise<void> => {
      return service.createTempTableForAssetValues();
    },

    insertAssetValuesStaging: async (
      values: AssetValueStagingInsert[]
    ): Promise<void> => {
      return service.insertAssetValuesStaging(assetId, values);
    },

    mergeStagingIntoAssetValues: async (
      runStartDate: Date,
      runEndDate: Date
    ): Promise<void> => {
      return service.mergeStagingIntoAssetValues(
        assetId,
        runStartDate,
        runEndDate
      );
    },

    clearStagingForJob: async (): Promise<void> => {
      return service.clearStagingForJob();
    },
  };
};
