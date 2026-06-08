import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DateRangeProvider, useDateRange } from "@milestone/js-common/react/context/DateRangeContext";
import { useAssets } from "@milestone/js-common/react/hooks/use-assets";
import { usePortfolioValue } from "@milestone/js-common/react/hooks/use-portfolio-value";
import { usePortfolioOverview } from "@milestone/js-common/react/hooks/use-portfolio-overview";
import { usePortfolioRangeReturns } from "@milestone/js-common/react/hooks/use-portfolio-range-returns";
import { usePortfolioTransactionHistory } from "@milestone/js-common/react/hooks/use-portfolio-transactions";
import { useBrokerPlatforms } from "@milestone/js-common/react/hooks/use-broker-platforms";
import { apiRequest } from "@milestone/js-common/api/transport";
import { portfolioGraphValues } from "@milestone/js-common/api/queryKeys";
import {
  assetValueTimePointSchema,
  type AssetValueTimePoint,
  type CombinedDayTimePointBase,
} from "@milestone/js-common/schema";
import {
  getAccountTypeFullName,
  getPlatformName,
} from "@milestone/js-common/utils/platform";
import { getDateUrlParams } from "@milestone/js-common/utils/date";
import ValuesChart, { type ChartData } from "@/components/charts/ValuesChart";
import DateRangeBar from "@/components/layout/DateRangeBar";
import { PosNegNumber } from "@/components/common/PosNegNumber";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDateRange } from "@/components/ui/DateRangeControl";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { cn } from "@/lib/cn";

function PortfolioContent() {
  const { dateRange } = useDateRange();
  const { start: startDate, end: endDate } = useMemo(
    () => getDateRange(dateRange),
    [dateRange]
  );

  const [showChart, setShowChart] = useState(false);

  const { data: brokerPlatforms } = useBrokerPlatforms();
  const { data: assets = [], isLoading: isLoadingAssets, isError: isErrorAssets, error: assetsError } =
    useAssets(startDate, endDate);
  const { data: portfolioOverview } = usePortfolioOverview(startDate, endDate);
  const { data: portfolioValue, isLoading: isLoadingPortfolioValue } = usePortfolioValue();
  const { data: rangeReturns, isFetching: isFetchingRangeReturns } =
    usePortfolioRangeReturns(startDate, endDate);

  const {
    data: assetValueHistoryData,
    isFetching: isFetchingAssetValueHistory,
    isError: isErrorAssetValueHistory,
    error: assetValueHistoryError,
  } = useQuery<AssetValueTimePoint[]>({
    queryKey: [...portfolioGraphValues, startDate, endDate],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await apiRequest<AssetValueTimePoint[]>(
        "GET",
        `/api/assets/portfolio-value/history?${getDateUrlParams(startDate, endDate)}&sort=valueDate,asc`
      );
      const result = assetValueTimePointSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid portfolio value history response: ${result.error.message}`);
      }
      return result.data;
    },
  });

  const {
    data: transactionHistoryData = [],
    isFetching: isFetchingTransactionHistory,
    isError: isErrorTransactionHistory,
    error: transactionHistoryError,
  } = usePortfolioTransactionHistory(startDate, endDate);

  const valuesChartData: CombinedDayTimePointBase[] = useMemo(() => {
    if (!Array.isArray(assetValueHistoryData) || assetValueHistoryData.length === 0) {
      return [];
    }
    return assetValueHistoryData.map((item) => {
      const itemDate = new Date(item.valueDate);
      return {
        ...item,
        timestamp: itemDate.getTime(),
        date: itemDate.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }),
        value: item.value,
        changes: item.changes,
        metadata: item.metadata
          ? Array.isArray(item.metadata)
            ? [...item.metadata]
            : [item.metadata]
          : [],
      };
    });
  }, [assetValueHistoryData]);

  const transactionChartData: CombinedDayTimePointBase[] = useMemo(() => {
    if (!transactionHistoryData.length) return [];
    return transactionHistoryData.map((item) => {
      const itemDate = new Date(item.valueDate);
      return {
        ...item,
        timestamp: itemDate.getTime(),
        date: itemDate.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }),
        value: item.value,
        changes: item.changes,
      };
    });
  }, [transactionHistoryData]);

  const [assetColor = "", txnColor = ""] = useThemeColors(["--asset", "--txn"]);

  const chartData: ChartData = [
    {
      id: "1",
      name: "Total Portfolio Value",
      color: assetColor,
      isLoading: isFetchingAssetValueHistory,
      ...(isErrorAssetValueHistory
        ? { error: assetValueHistoryError ?? new Error("Failed to load portfolio value history") }
        : { data: valuesChartData }),
    },
    {
      id: "2",
      name: "Transactions Input Value",
      color: txnColor,
      isLoading: isFetchingTransactionHistory,
      ...(isErrorTransactionHistory
        ? { error: transactionHistoryError ?? new Error("Failed to load transaction history") }
        : { data: transactionChartData }),
    },
  ];

  const onToggleChart = useCallback(() => {
    setShowChart((prev) => !prev);
  }, []);

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 pb-24">
      <View className="flex-row justify-between items-start mt-2">
        <View className="flex-1">
          <Text className="text-muted-foreground">Total Value</Text>
          {portfolioValue ? (
            <Text className="text-2xl font-bold text-foreground">
              £{Number(portfolioValue.value).toLocaleString()}
            </Text>
          ) : isLoadingPortfolioValue ? (
            <Text className="text-lg font-bold text-foreground">Loading portfolio total...</Text>
          ) : null}
          {portfolioOverview || portfolioValue ? (
            <View className="flex-row flex-wrap items-baseline gap-x-2 mt-1">
              {portfolioOverview ? (
                <PosNegNumber value={Number(portfolioOverview.currentChange)} />
              ) : null}
              {portfolioValue ? (
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-sm text-muted-foreground">(</Text>
                  {isFetchingRangeReturns && !rangeReturns ? (
                    <Skeleton className="h-4 w-20" />
                  ) : rangeReturns?.timeWeightedReturn == null ? (
                    <Text className="text-sm text-muted-foreground">—</Text>
                  ) : (
                    <PosNegNumber
                      value={Number(rangeReturns.timeWeightedReturn)}
                      displayInPercentage
                    />
                  )}
                  <Text className="text-sm text-muted-foreground">)</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <Button
          variant="ghost"
          size="icon"
          className={cn("border border-border", showChart && "bg-muted")}
          onPress={onToggleChart}
        >
          <Text className="text-primary text-lg">📈</Text>
        </Button>
      </View>

      <View className="my-4">
        <DateRangeBar />
      </View>

      {showChart ? <ValuesChart className="mt-2" data={chartData} /> : null}

      <View className="flex-row justify-between items-center my-4">
        <Text className="text-lg font-semibold text-foreground">Accounts</Text>
      </View>

      {isLoadingAssets ? (
        <View className="gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </View>
      ) : isErrorAssets ? (
        <Text className="text-muted-foreground text-center py-8">
          Error loading accounts: {assetsError?.message}
        </Text>
      ) : assets.length === 0 ? (
        <View className="py-8 items-center">
          <Text className="text-muted-foreground mb-4">No investment accounts added yet.</Text>
          <Text className="text-sm text-muted-foreground">
            Add accounts via the web client until account creation is ported.
          </Text>
        </View>
      ) : (
        <View className="rounded-lg border border-border bg-card overflow-hidden">
          {assets.map((asset) => {
            const platformName = asset.platformId
              ? getPlatformName(asset.platformId, brokerPlatforms ?? [])
              : null;

            return (
              <Pressable
                key={asset.id}
                className="py-3 px-4 border-b border-border active:bg-muted/50"
                onPress={() => router.push(`/(app)/asset/${asset.id}`)}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 pr-3">
                    {platformName ? (
                      <Text className="font-medium text-foreground">{platformName}</Text>
                    ) : null}
                    <Text className="text-sm text-foreground">
                      {getAccountTypeFullName(asset.accountType)}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {asset.startDate.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-semibold text-foreground">
                      £{Number(asset.currentValue).toLocaleString()}
                    </Text>
                    {asset.accountChange ? (
                      <PosNegNumber value={Number(asset.accountChange)} />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      </View>
    </ScrollView>
  );
}

export default function PortfolioScreen() {
  return (
    <DateRangeProvider>
      <PortfolioContent />
    </DateRangeProvider>
  );
}
