import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  AssetValueTimePoint,
  CombinedDayTimePointBase,
  UserAsset,
} from "@shared/schema";
import {
  getBrokerAccountTypeFullName,
  getBrokerSlugFromName,
} from "@/lib/broker";
import { useBrokerProviders } from "@/hooks/use-broker-providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrokerLogoBoxed from "@/components/logo/BrokerLogoBoxed";
import { AssetSecuritiesList } from "@/components/account/AssetSecuritiesList";
import AssetHistoryChart, { ChartData } from "@/components/charts/ValuesChart";
import DateRangeBar from "@/components/layout/DateRangeBar";
import { TransactionsPanel } from "@/components/account/TransactionsPanel";
import { useSecuritiesUpdate } from "@/hooks/use-securities-update";
import { DateRangeProvider, useDateRange } from "@/context/DateRangeContext";
import {
  DateRangeOption,
  getDateRange,
} from "@/components/ui/DateRangeControl";
import { SecuritiesTransactionsPanel } from "@/components/account/SecuritiesTransactionsPanel";
import { useAsset } from "@/hooks/use-asset";
import { getDateUrlParams } from "@/lib/date";
import { useAssetTransactions } from "@/hooks/use-asset-transactions";
import { AssetSecuritiesProvider } from "@/context/AssetSecuritiesContext";
import { assetGraphValues } from "@shared/api/queryKeys";
import { useAssetValues } from "@/hooks/use-asset-values";
import { AssetValueList } from "@/components/account/AssetValueList";

function AssetPage() {
  const params = useParams();

  const assetId: UserAsset["id"] | undefined = params?.id;

  const { dateRange } = useDateRange();

  const { start: startDate, end: endDate } = useMemo(() => {
    return getDateRange(dateRange as DateRangeOption);
  }, [dateRange]);

  const { data: providers, isLoading: isProvidersLoading } =
    useBrokerProviders();

  // Active tab state
  const [activeTab, setActiveTab] = useState<"values" | "contributions">(
    "contributions"
  );

  const { asset, isAssetLoading, isAssetError, assetError } = useAsset(assetId);

  const { assetValues: history, isLoading: isHistoryLoading } =
    useAssetValues(assetId);

  const { mutateAsync: updateAssetHistories } = useSecuritiesUpdate(
    assetId ?? ""
  );
  const [isUpdatingHistories, setIsUpdatingHistories] = useState(false);

  const { data: assetValueHistoryData, isLoading: isLoadingAssetValueHistory } =
    useQuery<AssetValueTimePoint[]>({
      //const { data: historyData, isLoading } = useQuery<AssetValue[]>({
      queryKey: [...assetGraphValues, startDate, endDate],
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
        return response.json();
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
  const { data: transactionHistoryData = [] } = assetTransactions;

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
            <p className="text-center text-gray-500">Account not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSecuritiesAsset = asset.valueMethod === "calculated";

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
      <div className="flex flex-col items-start mb-6">
        <div className="flex items-center gap-2">
          <BrokerLogoBoxed
            broker={
              asset.platform
                ? getBrokerSlugFromName(asset.platform.name)
                : undefined
            }
            size="md"
          />
          <div>
            <div className="mb-2">
              <h1 className="text-xl ">{asset.name}</h1>
            </div>
            <h1 className="text-xl font-semibold">{asset.platform?.name}</h1>
            <span className="text-sm text-gray-600">
              {getBrokerAccountTypeFullName(asset.accountType)}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-row justify-between items-center">
        <div className="flex flex-col">
          <span>Value</span>
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

      <AssetSecuritiesProvider assetId={assetId}>
        <div>
          {/* Holdings Section - only visible for calculated/securities assets */}
          {isSecuritiesAsset && (
            <div className="">
              <h2 className="text-lg font-medium my-2 md:my-4">Holdings</h2>
              <AssetSecuritiesList
                className="my-4"
                //onItemClick={handleSecurityClick}
              />
            </div>
          )}
          <Tabs
            value={activeTab}
            className="w-full mt-2 md:mt-4"
            onValueChange={(value) =>
              setActiveTab(value as "values" | "contributions")
            }
          >
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="contributions" className="flex-1">
                Contributions
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

            {/* Contributions Tab Content */}
            <TabsContent value="contributions">
              {assetId ? (
                isSecuritiesAsset ? (
                  <SecuritiesTransactionsPanel assetId={assetId} />
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
