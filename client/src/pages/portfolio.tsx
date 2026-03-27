import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartBar, ChartLine, Pencil, Trash2 } from "lucide-react";
///import AssetHistoryChart, { ChartData } from "@/components/charts/ValuesChart";
import AssetHistoryChart, { ChartData } from "@/components/charts/ValuesChartD3";

import DateRangeBar from "@/components/layout/DateRangeBar";
import { usePortfolio } from "@/context/PortfolioContext";
import { useToast } from "@/hooks/use-toast";
import { getNextMilestone } from "@/lib/utils/milestones";
import AddAccountDialogue from "@/components/account/AddAccountDialogue";
import { AssetValueTimePoint, assetValueTimePointSchema, UserAssetOrphanInsert } from "shared/schema";
import { DateRangeProvider, useDateRange } from "@/context/DateRangeContext";

import {
  getDateRange,
  DateRangeOption,
} from "@/components/ui/DateRangeControl";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import {
  getBrokerAccountTypeFullName,
  getBrokerSlugFromName,
} from "@/lib/broker";
import BrokerLogoBoxed from "@/components/logo/BrokerLogoBoxed";
import { getPlatformName } from "@/lib/platform";
import { usePortfolioTransactionHistory } from "@/hooks/use-portfolio-transactions";
import { CombinedDayTimePointBase } from "shared/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getDateUrlParams } from "@/lib/date";
import { portfolioGraphValues } from "@shared/api/queryKeys";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useAssetCreate } from "@/hooks/use-asset-create";
import { useAssetDelete } from "@/hooks/use-asset-delete";
import { PosNegNumber } from "@/components/common/PosNegNumber";
import { cn } from "@/lib/utils";
import { useAssets } from "@/hooks/use-assets";
import { usePortfolioValue } from "@/hooks/use-portfolio-value";
import { useThemeColors } from "@/hooks/use-theme-colors";

function Portfolio() {
  const { dateRange } = useDateRange();

  const { start: startDate, end: endDate } = useMemo(() => {
    return getDateRange(dateRange as DateRangeOption);
  }, [dateRange]);

  const [showChart, toggleChart] = useState(false);

  const { data: brokerPlatforms, isLoading: isLoadingBrokerPlatforms } =
    useBrokerPlatforms();

  const [, setLocation] = useLocation();

  const { milestones, isLoading } = usePortfolio(
    startDate,
    endDate
  );

  const { mutateAsync: deleteAsset } = useAssetDelete();

  const {
    data: assets = [],
    isLoading: isLoadingAssets,
    isError: isErrorAssets,
    error: assetsError,
  } = useAssets(startDate, endDate);

  const { mutateAsync: addAsset } = useAssetCreate();

  const {
    data: portfolioOverview,
    isLoading: isLoadingPortfolioOverview,
    isError: isErrorPortfolioOverview,
  } = usePortfolioOverview(startDate, endDate);

  const {
    data: portfolioValue,
    isLoading: isLoadingPortfolioValue,
    isError: isErrorPortfolioValue,
  } = usePortfolioValue() ;

  const { toast } = useToast();

  //const { data: historyData, isLoading } = useQuery<AssetHistoryTimePoint[]>({
  const { data: assetValueHistoryData, isLoading: isLoadingAssetValueHistory } =
    useQuery<AssetValueTimePoint[]>({
      //const { data: historyData, isLoading } = useQuery<AssetValue[]>({
      queryKey: [...portfolioGraphValues, startDate, endDate],
      placeholderData: keepPreviousData,
      queryFn: async () => {
        const response = await fetch(
          `/api/assets/portfolio-value/history?${getDateUrlParams(
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
          throw new Error(`Invalid portfolio value history response: ${result.error.message}`);
        }
        return result.data;
      },
    });

  const valuesChartData: CombinedDayTimePointBase[] =
    Array.isArray(assetValueHistoryData) && assetValueHistoryData.length > 0
      ? assetValueHistoryData.map((item) => {
          const itemDate = new Date(item.valueDate);

          // Find the highest milestone achieved at this point
          const achievedMilestone = milestones
            ?.filter((m) => {
              const portfolioValue = Number(item.value);
              const milestoneValue = Number(m.targetValue);
              return portfolioValue >= milestoneValue;
            })
            .sort((a, b) => Number(b.targetValue) - Number(a.targetValue))[0];
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

  const { data: transactionHistoryData = [] } = usePortfolioTransactionHistory(
    startDate,
    endDate
  );

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

  const chartData: ChartData = [
    {
      id: "1",
      name: "Total Portfolio Value",
      data: valuesChartData,
      color: assetColor,
    },
    {
      id: "2",
      name: "Transactions Input Value",
      data: transactionChartData,
      color: txnColor,
    },
  ];

  // Get start and end dates based on the selected date range

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMilestones, setShowMilestones] = useState(true);
  const [displayInPercentage, setDisplayInPercentage] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  // Get color for account type
  const getAccountTypeColor = (type: string) => {
    // Return black for all account types
    return "text-foreground font-semibold";
  };

  // Find next milestone for the portfolio if any
  // Convert DecimalValueString to number for getNextMilestone
  const nextMilestone = getNextMilestone(
    milestones ?? [],
    portfolioOverview?.value ? Number(portfolioOverview.value) : 0
  );

  const onSubmit = async (values: UserAssetOrphanInsert) => {
    try {
      await addAsset(values);
      setIsAddAccountOpen(false);
      toast({
        title: "Account added successfully",
        description:
          "Your new investment account has been added to your portfolio.",
      });
    } catch (error) {
      console.error("Error adding account:", error);
      toast({
        title: "Error adding account",
        description:
          "There was a problem adding your account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = useCallback(
    async (accountId: string) => {
      if (accountToDelete) {
        await deleteAsset(accountId);
        setAccountToDelete(null);
        setIsEditMode(false);
      }
    },
    [deleteAsset, accountToDelete, setAccountToDelete, setIsEditMode]
  );

  const onToggleChart = useCallback(() => {
    toggleChart(!showChart);
  }, [toggleChart, showChart]);

  return (
    <div className="max-w-5xl mx-auto px-2 md:px-4 pb-20">
      <div className="flex flex-row justify-between items-center">
        <div className="w-full flex flex-col">
          <span>Total Value</span>
          {portfolioValue ? (
            <>
              <div className="flex flex-row gap-2">
                <span className="text-2xl font-bold">
                  £{Number(portfolioValue.value).toLocaleString()}
                </span>
                <span className="text-2xl font-bold">
                  <PosNegNumber
                    value={Number(portfolioValue.returnValue) / 100}
                    displayInPercentage={true}
                  />
                </span>
              </div>
            </>
          ) : (
            <p className="font-bold text-lg">Loading portfolio total...</p>
          )}
          {portfolioOverview ?
              ( <PosNegNumber
                value={
                  displayInPercentage
                    ? // Convert percentage to decimal for sakes of Intl.NumberFormat
                      Number(portfolioOverview.currentChangePercentage) / 100
                    : Number(portfolioOverview.currentChange)
                }
                displayInPercentage={displayInPercentage}
              />
            ) : null}
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="lg"
            className={cn(
              "cursor-pointer border rounded-full w-10 h-10 p-2 m-0 flex items-center justify-center [&_svg]:!w-full [&_svg]:!h-full",
              showChart ? "bg-muted" : "bg-transparent"
            )}
            onClick={onToggleChart}
          >
            <ChartLine strokeWidth={1} />
          </Button>
        </div>
      </div>

      {/* Date Range Control */}
      <div className="my-4">
        <DateRangeBar />
      </div>

      {/* Chart Section */}
      {showChart ? (
        <AssetHistoryChart
          className="mt-4"
          data={chartData}
          // milestones={milestones ?? []}
          // showMilestones={showMilestones}
          // url="/api/assets/portfolio-value/history"
          // queryKey={["portfolio", "history", "graph"]}
          // nextMilestone={
          //   nextMilestone ? Number(nextMilestone.targetValue) : undefined
          // }
        />
      ) : null}
      {/* Portfolio Accounts List */}
      <div className="flex justify-between items-center my-4">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <div className="flex items-center space-x-4">
          <div className="flex bg-muted rounded-lg shadow-md">
            <button
              className={`text-sm font-medium py-1 px-3 rounded-lg transition-all ${
                !displayInPercentage
                  ? "bg-card text-foreground shadow-inner"
                  : "hover:bg-accent"
              }`}
              onClick={() => setDisplayInPercentage(false)}
            >
              £
            </button>
            <button
              className={`text-sm font-medium py-1 px-3 rounded-lg transition-all ${
                displayInPercentage
                  ? "bg-card text-foreground shadow-inner"
                  : "hover:bg-accent"
              }`}
              onClick={() => setDisplayInPercentage(true)}
            >
              %
            </button>
          </div>

          {/* Delete Account Alert Dialog */}
          <AlertDialog
            open={!!accountToDelete}
            onOpenChange={(open) => !open && setAccountToDelete(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all data associated with this investment
                  account, are you sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() =>
                    accountToDelete && handleDeleteAccount(accountToDelete)
                  }
                >
                  Yes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Edit Mode Toggle Button - Only shown when accounts exist */}
          {assets && assets.length > 0 ? (
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full w-10 h-10 flex items-center justify-center ${
                isEditMode
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "text-primary"
              }`}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <Pencil className="h-5 w-5" />
            </Button>
          ) : null}

          {/* Add Account Dialog */}
          <AddAccountDialogue
            open={isAddAccountOpen}
            onOpenChange={setIsAddAccountOpen}
            onSubmit={onSubmit}
          />
        </div>
      </div>

      {isLoadingAssets ? (
        // Skeleton loading state for accounts
        <div className="bg-card rounded-lg overflow-hidden">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="py-3 px-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Skeleton className="w-10 h-10 rounded-md mr-3" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        // List of accounts
        <>
          {isErrorAssets ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Error loading accounts: {assetsError?.message}
              </p>
            </div>
          ) : !assets || assets.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                No investment accounts added yet.
              </p>
              <Button
                onClick={() => setIsAddAccountOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Add Your First Account
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-lg overflow-hidden">
            {assets.map((asset) => {
              const platformName = asset.platformId
                ? getPlatformName(asset.platformId, brokerPlatforms ?? [])
                : null;
              return (
                <section
                  key={asset.id}
                  className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors relative"
                  onClick={(e) => {
                    if (!isEditMode) {
                      setLocation(`/asset/${asset.id}`);
                    }
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <BrokerLogoBoxed
                        broker={
                          platformName
                            ? getBrokerSlugFromName(platformName)
                            : undefined
                        }
                        size="md"
                      />
                      <div>
                        {/* <div className="mb-2">
                        <h2 className="text-xs text-gray-500  ">{asset.id}</h2>
                      </div> */}
                        {/* <div className="mb-2">
                        <span className="text-lg font-medium block">
                          {asset.name}
                        </span>
                      </div> */}
                        {platformName ? (
                          <div>
                            <span className="font-medium block">
                              {platformName}
                            </span>
                          </div>
                        ) : null}
                        <span
                          className={`text-sm block ${getAccountTypeColor(
                            asset.accountType
                          )}`}
                        >
                          {getBrokerAccountTypeFullName(asset.accountType)}
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          {asset.startDate.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {isEditMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAccountToDelete(asset.id);
                          }}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="font-semibold">
                          £{Number(asset.currentValue).toLocaleString()}
                        </p>
                        {asset.accountChange ? (
                          <PosNegNumber
                            value={
                              displayInPercentage
                                ? // Convert percentage to decimal for sakes of Intl.NumberFormat
                                  Number(
                                    asset.accountChange.currentChangePercentage
                                  ) / 100
                                : Number(asset.accountChange.currentChange)
                            }
                            displayInPercentage={displayInPercentage}
                          />
                        ) : (
                          <PosNegNumber
                            value={0}
                            displayInPercentage={displayInPercentage}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PortfolioWithRangeProvider() {
  return (
    <DateRangeProvider>
      <Portfolio />
    </DateRangeProvider>
  );
}
