import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DateRangeProvider, useDateRange } from "@milestone/js-common/react/context/DateRangeContext";
import { useRecordTransaction } from "@milestone/js-common/react/context/RecordTransactionContext";
import { useAsset } from "@milestone/js-common/react/hooks/use-asset";
import { useAssetDelete } from "@milestone/js-common/react/hooks/use-asset-delete";
import { useAssetTransactions } from "@milestone/js-common/react/hooks/use-asset-transactions";
import { useAssetCashBalance } from "@milestone/js-common/react/hooks/use-asset-cash-balance";
import { apiRequest } from "@milestone/js-common/api/transport";
import { assetGraphValues } from "@milestone/js-common/api/queryKeys";
import {
  assetValueTimePointSchema,
  type AssetValueTimePoint,
  type CombinedDayTimePointBase,
} from "@milestone/js-common/schema";
import { getAccountTypeFullName } from "@milestone/js-common/utils/platform";
import { getDateUrlParams } from "@milestone/js-common/utils/date";
import ValuesChart, { type ChartData } from "@/components/charts/ValuesChart";
import DateRangeBar from "@/components/layout/DateRangeBar";
import { TransactionsPanel } from "@/components/account/TransactionsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { AppModal } from "@/components/ui/modal";
import { getDateRange } from "@/components/ui/DateRangeControl";
import { useThemeColors } from "@/hooks/use-theme-colors";

function AssetDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assetId = id;
  const { setPageAssetId } = useRecordTransaction();
  const [activeTab, setActiveTab] = useState<"transactions" | "values">("transactions");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutateAsync: deleteAsset } = useAssetDelete();
  const { dateRange } = useDateRange();
  const { start: startDate, end: endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);

  useEffect(() => {
    setPageAssetId(assetId);
    return () => setPageAssetId(undefined);
  }, [assetId, setPageAssetId]);

  const { asset, isAssetLoading, isAssetError, assetError } = useAsset(assetId);
  const { cashBalance } = useAssetCashBalance(assetId);

  const {
    data: assetValueHistoryData,
    isFetching: isFetchingAssetValueHistory,
    isError: isErrorAssetValueHistory,
    error: assetValueHistoryError,
  } = useQuery<AssetValueTimePoint[]>({
    queryKey: [...assetGraphValues, assetId, startDate, endDate],
    placeholderData: keepPreviousData,
    enabled: !!assetId,
    queryFn: async () => {
      const data = await apiRequest<AssetValueTimePoint[]>(
        "GET",
        `/api/assets/${assetId}/history/graph?${getDateUrlParams(startDate, endDate)}&sort=valueDate,asc`
      );
      const result = assetValueTimePointSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid asset value history response: ${result.error.message}`);
      }
      return result.data;
    },
  });

  const { assetTransactions } = useAssetTransactions(assetId, startDate, endDate);
  const {
    data: transactionHistoryData = [],
    isFetching: isFetchingTransactionHistory,
    isError: isErrorTransactionHistory,
    error: transactionHistoryError,
  } = assetTransactions;

  const valuesChartData: CombinedDayTimePointBase[] = useMemo(() => {
    if (!Array.isArray(assetValueHistoryData) || assetValueHistoryData.length === 0) return [];
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
        ? { error: assetValueHistoryError ?? new Error("Failed to load asset value history") }
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

  if (isAssetLoading) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-48 w-full" />
      </ScrollView>
    );
  }

  if (isAssetError || !asset) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Card>
          <CardContent>
            <Text className="text-center text-muted-foreground">
              {assetError?.message ?? "Account not found"}
            </Text>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  const isSecuritiesAsset = asset.valueMethod === "calculated";

  const handleDeleteAccount = async () => {
    if (!assetId) return;
    await deleteAsset(assetId);
    router.replace("/(app)/(tabs)/portfolio");
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 pb-24">
        <View className="flex-row items-center gap-2 py-3">
          <Pressable onPress={() => router.back()}>
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-semibold text-foreground">
              {asset.platform?.name ?? asset.name}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {getAccountTypeFullName(asset.accountType)}
            </Text>
          </View>
          <Pressable onPress={() => setShowDeleteDialog(true)}>
            <Text className="text-sm text-destructive">Delete</Text>
          </Pressable>
        </View>

        <Card className="mb-4">
          <CardContent>
            <Text className="text-sm text-muted-foreground">Value</Text>
            <Text className="text-2xl font-bold text-foreground">
              £{Number(asset.currentValue).toLocaleString()}
            </Text>
          </CardContent>
        </Card>

        {isSecuritiesAsset ? (
          <Card className="mb-4">
            <CardContent>
              <Text className="text-sm text-muted-foreground">Cash balance</Text>
              {cashBalance.isLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <Text className="text-2xl font-bold text-foreground">
                  £{Number(cashBalance.data?.balance ?? 0).toLocaleString()}
                </Text>
              )}
            </CardContent>
          </Card>
        ) : null}

        <DateRangeBar />

        <ValuesChart className="mt-4 mb-4" data={chartData} />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "transactions", label: "Transactions" },
            { value: "values", label: "Account Values" },
          ]}
          className="mb-4"
        />

        {activeTab === "transactions" ? (
          isSecuritiesAsset ? (
            <Text className="text-sm text-muted-foreground py-4">
              Calculated account transactions are best managed on the web client for now.
            </Text>
          ) : assetId ? (
            <TransactionsPanel assetId={assetId} />
          ) : null
        ) : (
          <View className="rounded-lg border border-border overflow-hidden">
            {(assetValueHistoryData?.length ?? 0) === 0 ? (
              <Text className="text-sm text-muted-foreground py-6 text-center">
                No account values in this date range.
              </Text>
            ) : (
              assetValueHistoryData?.map((point) => {
                const itemDate = new Date(point.valueDate);
                return (
                  <View
                    key={`${point.valueDate}-${point.value}`}
                    className="flex-row justify-between px-4 py-3 border-b border-border"
                  >
                    <Text className="text-sm text-foreground">
                      {itemDate.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    <Text className="text-sm font-medium text-foreground">
                      £{Number(point.value).toLocaleString()}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>

      <AppModal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Account"
        description="This will delete all data associated with this investment account. Are you sure?"
        showCloseButton={false}
        scrollable={false}
      >
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" label="No" onPress={() => setShowDeleteDialog(false)} />
          <Button variant="destructive" label="Yes, delete" onPress={() => void handleDeleteAccount()} />
        </View>
      </AppModal>
    </ScrollView>
  );
}

export default function AssetDetailScreen() {
  return (
    <DateRangeProvider>
      <AssetDetailContent />
    </DateRangeProvider>
  );
}
