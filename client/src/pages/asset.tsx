import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MoreHorizontal, RefreshCcw } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AssetValueTimePoint,
  assetValueTimePointSchema,
  CombinedDayTimePointBase,
  UserAsset,
} from "@shared/schema";
import {
  getBrokerAccountTypeFullName,
  getBrokerSlugFromName,
} from "@/lib/broker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BrokerLogoBoxed from "@/components/logo/BrokerLogoBoxed";
import { AssetSecuritiesList } from "@/components/account/AssetSecuritiesList";
import AssetHistoryChart, { ChartData } from "@/components/charts/ValuesChartD3";
import DateRangeBar from "@/components/layout/DateRangeBar";
import { TransactionsPanel } from "@/components/account/TransactionsPanel";
import { useSecuritiesUpdate } from "@/hooks/use-securities-update";
import { DateRangeProvider, useDateRange } from "@/context/DateRangeContext";
import {
  DateRangeOption,
  getDateRange,
} from "@/components/ui/DateRangeControl";
import { CalculatedTransactionsPanel } from "@/components/account/CalculatedTransactionsPanel";
import { useAsset } from "@/hooks/use-asset";
import { getDateUrlParams } from "@/lib/date";
import { useAssetTransactions } from "@/hooks/use-asset-transactions";
import { AssetSecuritiesProvider } from "@/context/AssetSecuritiesContext";
import { assetGraphValues } from "@shared/api/queryKeys";
import { useAssetValues } from "@/hooks/use-asset-values";
import { useAssetDelete } from "@/hooks/use-asset-delete";
import { AssetValueList } from "@/components/account/AssetValueList";
import { AccountDetails } from "@/components/account/AccountDetails";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAssetCashBalance } from "@/hooks/use-asset-cash-balance";
import { Coins } from "lucide-react";
import { useRecordTransaction } from "@/context/RecordTransactionContext";
import { AssetProcessIndicator } from "@/components/account/AssetProcessIndicator";

function AssetPage() {
  const params = useParams();
  const [, setLocation] = useLocation();

  const assetId: UserAsset["id"] | undefined = params?.id;

  const { setPageAssetId } = useRecordTransaction();
  useEffect(() => {
    setPageAssetId(assetId);
    return () => setPageAssetId(undefined);
  }, [assetId, setPageAssetId]);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutateAsync: deleteAsset } = useAssetDelete();

  const { dateRange } = useDateRange();

  const { start: startDate, end: endDate } = useMemo(() => {
    return getDateRange(dateRange as DateRangeOption);
  }, [dateRange]);

  // Active tab state
  const [activeTab, setActiveTab] = useState<"values" | "transactions">(
    "transactions"
  );

  const { asset, isAssetLoading, isAssetError, assetError } = useAsset(assetId);

  const { assetValues: history, isLoading: isHistoryLoading } =
    useAssetValues(assetId);

  const { mutateAsync: updateAssetHistories } = useSecuritiesUpdate(
    assetId ?? ""
  );
  const [isUpdatingHistories, setIsUpdatingHistories] = useState(false);

  const {
    data: assetValueHistoryData,
    isFetching: isFetchingAssetValueHistory,
    isError: isErrorAssetValueHistory,
    error: assetValueHistoryError,
  } = useQuery<AssetValueTimePoint[]>({
      //const { data: historyData, isLoading } = useQuery<AssetValue[]>({
      queryKey: [...assetGraphValues, assetId, startDate, endDate],
      placeholderData: keepPreviousData,
      queryFn: async () => {
        const response = await fetch(
          `/api/assets/${assetId}/history/graph?${getDateUrlParams(
            startDate,
            endDate
          )}&sort=valueDate,asc`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch portfolio history");
        }
        const data = await response.json();
        const result = assetValueTimePointSchema.array().safeParse(data);
        if (!result.success) {
          throw new Error(`Invalid asset value history response: ${result.error.message}`);
        }
        return result.data;
      },
    });

  const valuesChartData: CombinedDayTimePointBase[] =
    Array.isArray(assetValueHistoryData) && assetValueHistoryData.length > 0
      ? assetValueHistoryData.map((item) => {
          const itemDate = new Date(item.valueDate);

          // Find the highest milestone achieved at this point
          // const achievedMilestone = milestones
          //   ?.filter((m) => {
          //     const portfolioValue = Number(item.value);
          //     const milestoneValue = Number(m.targetValue);
          //     return portfolioValue >= milestoneValue;
          //   })
          //   .sort((a, b) => Number(b.targetValue) - Number(a.targetValue))[0];
          return {
            ...item,
            timestamp: itemDate.getTime(),
            date: itemDate.toLocaleDateString("en-GB", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            }),
            // Keep value as DecimalValueString (not converted to number)
            value: item.value,
            changes: item.changes,
            // achievedMilestone: achievedMilestone
            //   ? {
            //       name: achievedMilestone.name,
            //       targetValue: Number(achievedMilestone.targetValue),
            //     }
            //   : undefined,
            metadata: item.metadata
              ? Array.isArray(item.metadata)
                ? [...item.metadata]
                : [item.metadata]
              : [],
          };
        })
      : [];

  const { assetTransactions } = useAssetTransactions(
    assetId,
    startDate,
    endDate
  );
  const {
    data: transactionHistoryData = [],
    isFetching: isFetchingTransactionHistory,
    isError: isErrorTransactionHistory,
    error: transactionHistoryError,
  } = assetTransactions;

  const transactionChartData: CombinedDayTimePointBase[] =
    transactionHistoryData && transactionHistoryData.length > 0
      ? transactionHistoryData.map((item) => {
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
        })
      : [];

  const [assetColor = "", txnColor = ""] = useThemeColors(["--asset", "--txn"]);

  const { cashBalance } = useAssetCashBalance(assetId);

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

  // const handleSecurityClick = (item: { id: string }) => {
  //   navigate(`/asset/broker/${assetId}/item/${item.id}`);
  // };

  if (isAssetLoading || isHistoryLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center mb-6">
              <Skeleton className="w-10 h-10 rounded-md mr-3" />
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="space-y-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="max-w-5xl mx-auto px-2 md:px-4 py-8">
        <Card>
          <CardContent className="p-4">
            <p className="text-center text-muted-foreground">Account not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSecuritiesAsset = asset.valueMethod === "calculated";

  const handleDeleteAccount = async () => {
    if (!assetId) return;
    await deleteAsset(assetId);
    setLocation("/portfolio");
  };

  const handleUpdateAssetHistories = async () => {
    if (!assetId) return;
    setIsUpdatingHistories(true);
    await updateAssetHistories()
      .then(() => {
        setIsUpdatingHistories(false);
      })
      .catch((error) => {
        console.error("Error updating asset histories", error);
        setIsUpdatingHistories(false);
      });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-card rounded-lg p-4 mb-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <BrokerLogoBoxed
          broker={
            asset.platform
              ? getBrokerSlugFromName(asset.platform.name)
              : undefined
          }
          size="md"
        />
        <div>
          {/* TODO: Being able to add a custom account name is temporarily disabled and so we do not display. */}
          {/* <div className="mb-2">
            <h1 className="text-xl ">{asset.name}</h1>
          </div> */}
          <h1 className="text-xl font-semibold">{asset.platform?.name}</h1>
          <span className="text-sm text-muted-foreground">
            {getBrokerAccountTypeFullName(asset.accountType)}
          </span>
        </div>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setShowDeleteDialog(true)}
              >
                Delete Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all data associated with this investment account,
              are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAccount}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-card rounded-lg p-4 mb-4 flex flex-row justify-between items-center">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">Value</span>
          <span className="text-2xl font-bold">
            £{Number(asset.currentValue).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={handleUpdateAssetHistories}
            disabled={isUpdatingHistories}
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AssetProcessIndicator assetId={assetId} />

      {/* Date Range Control */}
      <div className="my-4">
        <DateRangeBar />
      </div>

      {/* Chart Section */}
      {assetId ? (
        <AssetHistoryChart
          className="mt-4"
          data={chartData}
          // showMilestones={false}
          // url={`/api/assets/${assetId}/history/graph`}
          // queryKey={["asset", assetId, "history", "graph"]}
          // nextMilestone={
          //   nextMilestone ? Number(nextMilestone.targetValue) : undefined
          // }
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <AccountDetails asset={asset} editableFields={{ startDate: true }} />
      </div>

      {isSecuritiesAsset && (
        <div className="bg-card rounded-lg p-4 my-4 flex items-center gap-3">
          <Coins className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Cash balance</span>
            {cashBalance.isLoading ? (
              <Skeleton className="h-7 w-24 mt-1" />
            ) : (
              <span className="text-2xl font-bold">
                £{Number(cashBalance.data?.balance ?? 0).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      <AssetSecuritiesProvider
        assetId={assetId}
        assetStartDate={new Date(asset.startDate)}
      >
        <div>
          {/* Holdings Section - only visible for calculated/securities assets */}
          {isSecuritiesAsset && (
            <div className="">
              <h2 className="text-lg font-medium my-2 md:my-4">Investments</h2>
              <AssetSecuritiesList
                className="my-4"
                canAddSecurity={false}
                //onItemClick={handleSecurityClick}
              />
            </div>
          )}
          <Tabs
            value={activeTab}
            className="w-full mt-2 md:mt-4"
            onValueChange={(value) =>
              setActiveTab(value as "values" | "transactions")
            }
          >
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="transactions" className="flex-1">
                Transactions
              </TabsTrigger>
              <TabsTrigger value="values" className="flex-1">
                Account Values
              </TabsTrigger>
            </TabsList>

            {/* Values Tab Content */}
            <TabsContent value="values">
              {assetId ? (
                <AssetValueList
                  values={history}
                  assetId={assetId}
                  readOnly={isSecuritiesAsset}
                />
              ) : null}
            </TabsContent>

            {/* Transactions tab */}
            <TabsContent value="transactions">
              {assetId ? (
                isSecuritiesAsset ? (
                  <CalculatedTransactionsPanel
                    asset={asset}
                    assetId={assetId}
                    statementPlatformKey={asset.platformId ?? undefined}
                  />
                ) : (
                  <TransactionsPanel assetId={assetId} />
                )
              ) : null}
            </TabsContent>
            {/* Recurring Contributions Tab Content */}
          </Tabs>
        </div>
      </AssetSecuritiesProvider>
    </div>
  );
}

export default function AssetWithRangeProvider() {
  return (
    <DateRangeProvider>
      <AssetPage />
    </DateRangeProvider>
  );
}
