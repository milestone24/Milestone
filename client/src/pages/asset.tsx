import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, RefreshCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePortfolio } from "@/context/PortfolioContext";
import {
  AssetValue,
  AssetValueTimePoint,
  CombinedDayTimePointBase,
  ResolvedUserAsset,
  UserAsset,
  WithResolvedSecurities,
  createDecimalValueString,
} from "@shared/schema";
import {
  getBrokerAccountTypeFullName,
  getBrokerName,
  getBrokerSlugFromName,
} from "@/lib/broker";
import { useBrokerProviders } from "@/hooks/use-broker-providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrokerLogoBoxed from "@/components/logo/BrokerLogoBoxed";
import { SecuritiesList } from "@/components/account/SecuritiesList";
import { navigate } from "wouter/use-browser-location";
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

// Form schema for history entry
const historySchema = z.object({
  value: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Value must be a positive number",
  }),
  recordedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
});

function AssetPage() {
  const params = useParams();

  const assetId: UserAsset["id"] | undefined = params?.id;

  const { dateRange } = useDateRange();

  const { start: startDate, end: endDate } = useMemo(() => {
    return getDateRange(dateRange as DateRangeOption);
  }, [dateRange]);

  const { addAssetValue, updateAssetValue, deleteAssetValue } = usePortfolio();

  const { data: providers, isLoading: isProvidersLoading } =
    useBrokerProviders();

  // State for history (values) tab
  const [isAddHistoryOpen, setIsAddHistoryOpen] = useState(false);
  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);
  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);
  const [historyToEdit, setHistoryToEdit] = useState<any>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<"values" | "contributions">(
    "contributions"
  );

  const { asset, isAssetLoading, isAssetError, assetError } = useAsset(assetId);

  const { data: history, isLoading: isHistoryLoading } = useQuery<AssetValue[]>(
    {
      queryKey: ["user-asset-history", assetId],
      queryFn: () =>
        apiRequest<AssetValue[]>(
          "GET",
          `/api/assets/${assetId}/history?sort=valueDate,desc`
        ),
    }
  );

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

  // Form for adding/editing history
  const form = useForm<z.infer<typeof historySchema>>({
    resolver: zodResolver(historySchema),
    defaultValues: {
      value: "",
      recordedAt: new Date().toISOString().split("T")[0],
    },
  });

  const handleCreateHistory = async (values: z.infer<typeof historySchema>) => {
    if (!assetId) return;

    try {
      await addAssetValue.mutateAsync({
        assetId: assetId,
        value: createDecimalValueString(values.value),
        recordedAt: new Date(),
        valueDate: new Date(values.recordedAt),
      });
      setIsAddHistoryOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error creating history:", error);
    }
  };

  const handleEditHistory = async (values: z.infer<typeof historySchema>) => {
    if (!historyToEdit || !assetId) return;
    try {
      await updateAssetValue.mutateAsync({
        historyId: historyToEdit.id,
        assetId: assetId,
        value: createDecimalValueString(values.value),
        valueDate: new Date(values.recordedAt),
        recordedAt: new Date(),
      });
      setIsEditHistoryOpen(false);
      form.reset();
      setHistoryToEdit(null);
    } catch (error) {
      console.error("Error updating history:", error);
    }
  };

  const handleDeleteHistory = async () => {
    if (!historyToDelete) return;

    try {
      if (!assetId) return;
      await deleteAssetValue.mutateAsync({
        assetId: assetId,
        historyId: historyToDelete,
      });
      setHistoryToDelete(null);
    } catch (error) {
      console.error("Error deleting history:", error);
    }
  };

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
          <div className="">
            <h2 className="text-lg font-medium my-2 md:my-4">Holdings</h2>
            <SecuritiesList
              className="my-4"
              //onItemClick={handleSecurityClick}
            />
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "values" | "contributions")
            }
          >
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="values" className="flex-1">
                Account Values
              </TabsTrigger>
              <TabsTrigger value="contributions" className="flex-1">
                Contributions
              </TabsTrigger>
            </TabsList>

            {/* Values Tab Content */}
            <TabsContent value="values">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium">History</h2>
                  {!isSecuritiesAsset ? (
                    <Dialog
                      open={isAddHistoryOpen}
                      onOpenChange={setIsAddHistoryOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Value
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add History Entry</DialogTitle>
                          <DialogDescription>
                            Add a new value record for this account.
                          </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                          <form
                            onSubmit={form.handleSubmit(handleCreateHistory)}
                            className="space-y-4"
                          >
                            <FormField
                              control={form.control}
                              name="value"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Value</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="Enter value"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="recordedAt"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <DialogFooter>
                              <Button type="submit">Add Entry</Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </div>

                {/* History List */}
                <div className="space-y-4">
                  {history?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No account value history available.
                    </div>
                  )}
                  {history?.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          £{Number(entry.value).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(entry.valueDate).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setHistoryToEdit(entry);
                            form.reset({
                              value: entry.value.toString(),
                              recordedAt: new Date(entry.recordedAt)
                                .toISOString()
                                .split("T")[0],
                            });
                            setIsEditHistoryOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setHistoryToDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* Edit History Dialog */}
      <Dialog open={isEditHistoryOpen} onOpenChange={setIsEditHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit History Entry</DialogTitle>
            <DialogDescription>
              Update the value and date of this history entry.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleEditHistory)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter value"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recordedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit">Update Entry</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete History Confirmation Dialog */}
      <AlertDialog
        open={!!historyToDelete}
        onOpenChange={() => setHistoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete History Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this history entry? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHistory}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
