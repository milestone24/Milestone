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
import AssetHistoryChart, { ChartData } from "@/components/charts/ValuesChart";
import DateRangeBar from "@/components/layout/DateRangeBar";
import { usePortfolio } from "@/context/PortfolioContext";
import { useToast } from "@/hooks/use-toast";
import { getNextMilestone } from "@/lib/utils/milestones";
import AddAccountDialogue from "@/components/account/AddAccountDialogue";
import { AssetValueTimePoint, UserAssetOrphanInsert } from "shared/schema";
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
import { useQuery } from "@tanstack/react-query";
import { getDateUrlParams } from "@/lib/date";
import { portfolioGraphValues } from "@shared/api/queryKeys";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useAssetCreate } from "@/hooks/use-asset-create";
import { PosNegNumber } from "@/components/common/PosNegNumber";
import { cn } from "@/lib/utils";
import { useAssets } from "@/hooks/use-assets";

function Portfolio() {
  const { dateRange } = useDateRange();

  const { start: startDate, end: endDate } = useMemo(() => {
    return getDateRange(dateRange as DateRangeOption);
  }, [dateRange]);

  const [showChart, toggleChart] = useState(false);

  const { data: brokerPlatforms, isLoading: isLoadingBrokerPlatforms } =
    useBrokerPlatforms();

  const [, setLocation] = useLocation();

  const { milestones, deleteAsset, isLoading } = usePortfolio(
    startDate,
    endDate
  );

  const { data: assets, isLoading: isLoadingAssets } = useAssets(
    startDate,
    endDate
  );

  const { mutateAsync: addAsset } = useAssetCreate();

  const { data: portfolioOverview } = usePortfolioOverview(startDate, endDate);

  const { toast } = useToast();

  //const { data: historyData, isLoading } = useQuery<AssetHistoryTimePoint[]>({
  const { data: assetValueHistoryData, isLoading: isLoadingAssetValueHistory } =
    useQuery<AssetValueTimePoint[]>({
      //const { data: historyData, isLoading } = useQuery<AssetValue[]>({
      queryKey: [...portfolioGraphValues, startDate, endDate],
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
        return response.json();
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

  const chartData: ChartData = [
    {
      id: "1",
      name: "Total Portfolio Value",
      data: valuesChartData,
      color: "#3B82F6",
    },
    {
      id: "2",
      name: "Transactions Input Value",
      data: transactionChartData,
      color: "#F59E0B",
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
    return "text-black font-semibold";
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
        await deleteAsset.mutateAsync(accountId);
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
          {portfolioOverview ? (
            <>
              <span className="text-2xl font-bold">
                £{Number(portfolioOverview.value).toLocaleString()}
              </span>
              <PosNegNumber
                value={
                  displayInPercentage
                    ? // Convert percentage to decimal for sakes of Intl.NumberFormat
                      Number(portfolioOverview.currentChangePercentage) / 100
                    : Number(portfolioOverview.currentChange)
                }
                displayInPercentage={displayInPercentage}
              />
            </>
          ) : (
            <p className="font-bold text-lg">Loading portfolio total...</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="lg"
            className={cn(
              "cursor-pointer border rounded-full w-10 h-10 p-2 m-0 flex items-center justify-center [&_svg]:!w-full [&_svg]:!h-full",
              showChart ? "bg-gray-100" : "bg-transparent"
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
          <div className="flex bg-gray-200 rounded-lg shadow-md">
            <button
              className={`text-sm font-medium py-1 px-3 rounded-lg transition-all ${
                !displayInPercentage
                  ? "bg-white text-black shadow-inner"
                  : "hover:bg-gray-300"
              }`}
              onClick={() => setDisplayInPercentage(false)}
            >
              £
            </button>
            <button
              className={`text-sm font-medium py-1 px-3 rounded-lg transition-all ${
                displayInPercentage
                  ? "bg-white text-black shadow-inner"
                  : "hover:bg-gray-300"
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
                  ? "bg-blue-100 border-blue-300 text-blue-600"
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
        Array(3)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="border-b border-gray-200 py-3">
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
          ))
      ) : !assets || assets.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500 mb-4">
            No investment accounts added yet.
          </p>
          <Button
            onClick={() => setIsAddAccountOpen(true)}
            className="bg-black text-white hover:bg-gray-800"
          >
            Add Your First Account
          </Button>
        </div>
      ) : (
        // List of accounts
        <>
          {assets.map((asset) => {
            const platformName = asset.platformId
              ? getPlatformName(asset.platformId, brokerPlatforms ?? [])
              : null;
            return (
              <section
                key={asset.id}
                className="border-b border-gray-200 py-3 cursor-pointer hover:bg-gray-50 transition-colors relative"
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
                      <div className="mb-2">
                        <span className="text-lg font-medium block">
                          {asset.name}
                        </span>
                      </div>
                      {platformName ? (
                        <div>
                          <span className="font-medium block">
                            {platformName}
                          </span>
                        </div>
                      ) : null}
                      <span
                        className={`text-sm ${getAccountTypeColor(
                          asset.accountType
                        )}`}
                      >
                        {getBrokerAccountTypeFullName(asset.accountType)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {isEditMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mr-2 text-red-600 hover:text-red-800 hover:bg-red-50"
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

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Last updated on{" "}
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              •
              <Button
                variant="link"
                className="text-primary font-medium p-0 ml-1"
                onClick={() => setLocation("/record")}
              >
                Update Now
              </Button>
            </p>
          </div>
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
