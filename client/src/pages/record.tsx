import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  Edit,
  Check,
  X,
  Calendar,
  PlusCircle,
  Coins,
  RotateCcw,
  Clock,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { SiTradingview, SiCoinbase } from "react-icons/si";
import { BsPiggyBank } from "react-icons/bs";
import { useMilestones } from "@/hooks/use-milestones";
import { useToast } from "@/hooks/use-toast";
import DateRangeBar from "@/components/layout/DateRangeBar";
import { getBrokerName } from "@/lib/broker";
import {
  UserAsset,
  AssetValue,
  AssetTransaction,
  AssetContributionInsert,
} from "shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { DocumentUpload } from "@/components/record/DocumentUpload";
import { useAssets } from "@/hooks/use-assets";
type AccountFormData = {
  [key: string]: number | undefined;
};

const assetWithValeGuard = (
  formValue: [string, number | undefined]
): formValue is [string, number] => {
  return formValue[1] !== undefined && !isNaN(formValue[1]);
};

export default function Record() {
  const { isLoading } = useMilestones();

  const { data: brokerPlatforms } = useBrokerPlatforms();

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();

  // Create a function to handle contribution submissions
  const addContributionToAsset = async (
    assetId: string,
    value: number,
    date: Date
  ) => {
    try {
      await apiRequest("POST", `/api/assets/${assetId}/contributions`, {
        value,
        recordedAt: date,
      });

      toast({
        title: "Contribution recorded",
        description: "Your contribution has been recorded successfully.",
      });

      return true;
    } catch (error) {
      console.error("Error recording contribution:", error);
      toast({
        title: "Error recording contribution",
        description: "Failed to record contribution. Please try again.",
        variant: "destructive",
      });

      return false;
    }
  };

  // State to manage which tab is currently active
  const [activeTab, setActiveTab] = useState<"values" | "contributions">(
    "values"
  );

  // Helper to get logo for provider
  const getProviderLogo = (providerName: string) => {
    switch (providerName.toLowerCase()) {
      case "trading 212":
      case "trading212":
        return <SiTradingview className="w-6 h-6" />;
      case "vanguard":
        return <BsPiggyBank className="w-6 h-6" />;
      case "invest engine":
      case "investengine":
        return <SiCoinbase className="w-6 h-6" />;
      case "hargreaves lansdown":
        return <BsPiggyBank className="w-6 h-6" />;
      case "aj bell":
        return <SiCoinbase className="w-6 h-6" />;
      default:
        return <SiTradingview className="w-6 h-6" />;
    }
  };

  // Get color for account type
  const getAccountTypeColor = (type: string) => {
    // Return black for all account types
    return "text-foreground font-semibold";
  };

  const { toast } = useToast();
  const [accountValues, setAccountValues] = useState<AccountFormData>({});
  const [contributionValues, setContributionValues] = useState<AccountFormData>(
    {}
  );
  const [date, setDate] = useState<string>(
    /** @ts-ignore */
    new Date().toISOString().split("T")[0]
  );

  // Format date for display
  const formatDateForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const [submitting, setSubmitting] = useState(false);
  const [submittingContributions, setSubmittingContributions] = useState(false);
  const [updatingAccounts, setUpdatingAccounts] = useState<string[]>([]);
  const [updatingContributions, setUpdatingContributions] = useState<string[]>(
    []
  );

  // State for the recurring contributions info box visibility
  const [showRecurringInfo, setShowRecurringInfo] = useState<boolean | null>(
    null
  );

  // Handle permanently hiding the info box
  const handleHideInfoBox = () => {
    localStorage.setItem("hideRecurringContributionInfo", "true");
    setShowRecurringInfo(false);
  };

  // Handle "Remind Me Later" for the info box
  const handleRemindLater = () => {
    const now = new Date();
    localStorage.setItem("remindRecurringContributionLater", now.toISOString());
    localStorage.removeItem("hideRecurringContributionInfo"); // Clear any permanent hide setting
    setShowRecurringInfo(false);
  };

  // Check localStorage for the user's preference on info box visibility
  useEffect(() => {
    const hideRecurringInfo = localStorage.getItem(
      "hideRecurringContributionInfo"
    );
    const lastRemindDate = localStorage.getItem(
      "remindRecurringContributionLater"
    );

    if (hideRecurringInfo === "true") {
      setShowRecurringInfo(false);
    } else if (lastRemindDate) {
      // Check if it's been at least a day since "Remind Me Later" was clicked
      const lastDate = new Date(lastRemindDate);
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000; // One day in milliseconds

      if (now.getTime() - lastDate.getTime() >= oneDayMs) {
        // It's been at least a day, show the message again
        setShowRecurringInfo(true);
      } else {
        setShowRecurringInfo(false);
      }
    } else {
      // No preference saved, show the message
      setShowRecurringInfo(true);
    }
  }, []);

  // Initialize values with current values button
  const initializeWithCurrentValues = () => {
    const initialValues: AccountFormData = {};
    assets.forEach((asset) => {
      initialValues[asset.id] = Number(asset.currentValue);
    });
    setAccountValues(initialValues);
  };

  // History dialog states
  const [editHistoryRecord, setEditHistoryRecord] = useState<AssetValue | null>(
    null
  );
  const [editValue, setEditValue] = useState<string>("");

  // Find account name by ID
  const getAssetName = (assetId: string) => {
    const asset = assets.find((acc) => acc.id === assetId);

    return asset?.platformId
      ? `${getBrokerName(asset.platformId, brokerPlatforms ?? [])} (${
          asset.accountType
        })`
      : "Unknown Account";
  };

  // Start editing a history record
  const handleEditRecord = (record: AssetValue) => {
    setEditHistoryRecord(record);
    setEditValue(record.value.toString());
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditHistoryRecord(null);
    setEditValue("");
  };

  console.log("brokerAssets", assets);

  // // Save edited record
  // const handleSaveEdit = async () => {
  //   if (!editHistoryRecord) return;

  //   try {
  //     // Use the updateAccountHistory function to update the record
  //     await updateAsset.mutateAsync({
  //       assetId: editHistoryRecord.assetId,
  //       value: Number(editValue),
  //       valueDate: new Date(editHistoryRecord.recordedAt),
  //       recordedAt: new Date(),
  //       historyId: editHistoryRecord.id,
  //     });

  //     setEditHistoryRecord(null);
  //     setEditValue("");
  //   } catch (error) {
  //     console.error("Error updating history record:", error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to update history record. Please try again.",
  //       variant: "destructive",
  //     });
  //   }
  // };

  // Handle input change for account values
  const handleAccountValueChange = (assetId: string, value: string) => {
    setAccountValues((prev) => ({
      ...prev,
      [assetId]: value === "" ? undefined : Number(value),
    }));
  };

  // Handle input change for contributions
  const handleContributionValueChange = (assetId: string, value: string) => {
    setContributionValues((prev) => ({
      ...prev,
      [assetId]: value === "" ? undefined : Number(value),
    }));
  };

  // Handle form submission for a single account
  // const handleSubmitAccount = async (assetId: string) => {
  //   const value = accountValues[assetId];

  //   if (!value || !date) {
  //     toast({
  //       title: "Missing information",
  //       description: "Please enter a value for this account",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   setUpdatingAccounts((prev) => [...prev, assetId]);

  //   try {
  //     await addAsset.mutateAsync({
  //       assetId,
  //       value,
  //       valueDate: new Date(date),
  //       recordedAt: new Date(),
  //     });

  //     toast({
  //       title: "Value recorded",
  //       description: "Account value has been updated successfully",
  //     });

  //     // Clear the value for this account
  //     setAccountValues((prev) => {
  //       const newValues = { ...prev };
  //       delete newValues[assetId];
  //       return newValues;
  //     });
  //   } catch (error) {
  //     console.error("Error recording value:", error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to record value. Please try again.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setUpdatingAccounts((prev) => prev.filter((id) => id !== assetId));
  //   }
  // };

  // Handle form submission for a single account contribution
  // const handleSubmitContribution = async (assetId: string) => {
  //   const value = contributionValues[assetId];

  //   if (!value || !date) {
  //     toast({
  //       title: "Missing information",
  //       description: "Please enter a contribution amount for this account",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   setUpdatingContributions((prev) => [...prev, assetId]);

  //   try {
  //     const success = await addContributionToAsset(
  //       assetId,
  //       value,
  //       new Date(date)
  //     );

  //     if (success) {
  //       // Clear the value for this account
  //       setContributionValues((prev) => {
  //         const newValues = { ...prev };
  //         delete newValues[assetId];
  //         return newValues;
  //       });
  //     }
  //   } finally {
  //     setUpdatingContributions((prev) => prev.filter((id) => id !== assetId));
  //   }
  // };

  // Handle submission of all accounts at once
  const handleSubmitAll = async () => {
    const dataWithValues: [string, number][] =
      Object.entries(accountValues).filter(assetWithValeGuard);

    const accountsToUpdate = dataWithValues.map(([id, value]) => ({
      assetId: id,
      value: value,
      valueDate: new Date(date),
      recordedAt: new Date(),
    }));

    if (accountsToUpdate.length === 0) {
      toast({
        title: "No values to update",
        description: "Please enter at least one account value",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      await Promise.all(
        accountsToUpdate.map(async (accountData) => {
          throw new Error("Not implemented");
          //await addAsset.mutateAsync(accountData);
        })
      );

      toast({
        title: "Values recorded",
        description: `Updated ${accountsToUpdate.length} account(s) successfully`,
      });

      // Reset all values
      setAccountValues({});
    } catch (error) {
      console.error("Error recording values:", error);
      toast({
        title: "Error",
        description: "Failed to record some values. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle submission of all contributions at once
  const handleSubmitAllContributions = async () => {
    const dataWithValues: [string, number][] =
      Object.entries(contributionValues).filter(assetWithValeGuard);

    const contributionsToAdd = dataWithValues.map(([id, value]) => ({
      assetId: id,
      value: value,
      recordedAt: new Date(date),
    }));

    if (contributionsToAdd.length === 0) {
      toast({
        title: "No contributions to record",
        description: "Please enter at least one contribution amount",
        variant: "destructive",
      });
      return;
    }

    setSubmittingContributions(true);

    try {
      const results = await Promise.all(
        contributionsToAdd.map(async (contributionData) => {
          return await addContributionToAsset(
            contributionData.assetId,
            contributionData.value,
            contributionData.recordedAt
          );
        })
      );

      // Check if all contributions were successful
      const successCount = results.filter((result) => result === true).length;

      if (successCount > 0) {
        toast({
          title: "Contributions recorded",
          description: `Recorded ${successCount} contribution(s) successfully`,
        });

        // Reset all values
        setContributionValues({});
      }
    } catch (error) {
      console.error("Error recording contributions:", error);
      toast({
        title: "Error",
        description: "Failed to record some contributions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingContributions(false);
    }
  };

  return (
    <div className="record-screen max-w-5xl mx-auto px-4 pb-20">
      {/* Date Range Control */}
      <DateRangeBar className="mt-4 rounded-lg" />

      <Card className="mt-4">
        <CardHeader className="relative">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-semibold">
                Record Account Updates
              </CardTitle>
              <CardDescription className="mt-1">
                Update your account values and track your contributions over
                time.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-primary border-primary hover:bg-primary hover:text-white relative h-9"
                onClick={() => {
                  // Create a click event on the date input
                  const dateInput =
                    document.getElementById("record-date-input");
                  if (dateInput) {
                    dateInput.click();
                  }
                }}
              >
                <Calendar size={16} />
                <input
                  id="record-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full cursor-pointer"
                  aria-label="Select date"
                />
                <span>{formatDateForDisplay(date)}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">
                You don't have any accounts yet. Add accounts in the Portfolio
                section.
              </p>
            </div>
          ) : (
            <>
              <Tabs
                defaultValue="values"
                value={activeTab}
                onValueChange={(value) =>
                  setActiveTab(value as "values" | "contributions")
                }
                className="mb-6"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="values"
                    className="flex items-center gap-2"
                  >
                    <Coins size={16} />
                    Account Values
                  </TabsTrigger>
                  <TabsTrigger
                    value="contributions"
                    className="flex items-center gap-2"
                  >
                    <PlusCircle size={16} />
                    Contributions
                  </TabsTrigger>
                </TabsList>

                {/* Account Values Tab */}
                <TabsContent value="values">
                  <div className="space-y-4">
                    <DocumentUpload
                      assets={assets}
                      onExtractedValues={(extractedValues) => {
                        const newValues = { ...accountValues };

                        extractedValues.forEach(({ assetId, value }) => {
                          newValues[assetId] = value;
                        });

                        setAccountValues(newValues);
                      }}
                    />
                    {[...assets]
                      .sort(
                        (a, b) =>
                          Number(b.currentValue) - Number(a.currentValue)
                      )
                      .map((asset) => (
                        <div
                          key={asset.id}
                          className="p-4 border rounded-lg bg-card"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                            {/* Column 1: Provider Logo and Information */}
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-md flex items-center justify-center mr-3">
                                {getProviderLogo(
                                  asset.platformId
                                    ? getBrokerName(
                                        asset.platformId,
                                        brokerPlatforms ?? []
                                      )
                                    : "Unknown Account"
                                )}
                              </div>
                              <div>
                                <h3 className="font-medium">
                                  {asset.platformId
                                    ? getBrokerName(
                                        asset.platformId,
                                        brokerPlatforms ?? []
                                      )
                                    : "Unknown Account"}
                                </h3>
                                <span
                                  className={`text-sm ${getAccountTypeColor(
                                    asset.accountType
                                  )}`}
                                >
                                  {asset.accountType === "LISA"
                                    ? "Lifetime ISA"
                                    : asset.accountType === "GIA"
                                    ? "General Account"
                                    : asset.accountType === "ISA"
                                    ? "Individual Savings Account"
                                    : asset.accountType}
                                </span>
                              </div>
                            </div>

                            {/* Column 2: New Value Input */}
                            <div className="flex items-center justify-end">
                              <div className="relative md:w-1/3 w-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-muted-foreground">£</span>
                                </div>
                                <Input
                                  type="number"
                                  className="pl-7"
                                  placeholder={`${Number(
                                    asset.currentValue
                                  ).toLocaleString()}`}
                                  value={accountValues[asset.id] || ""}
                                  onChange={(e) =>
                                    handleAccountValueChange(
                                      asset.id,
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleSubmitAll}
                      disabled={
                        submitting ||
                        isLoading ||
                        Object.keys(accountValues).length === 0
                      }
                      className="md:w-1/3 w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {submitting ? (
                        <>
                          <span className="mr-2">Updating...</span>
                          <span className="animate-spin">⏳</span>
                        </>
                      ) : (
                        "Update Account Values"
                      )}
                    </Button>
                  </div>

                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    <p>
                      Regularly updating your account values helps you track
                      your progress and keeps your portfolio data accurate.
                    </p>
                  </div>
                </TabsContent>

                {/* Contributions Tab */}
                <TabsContent value="contributions">
                  {showRecurringInfo && (
                    <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg mb-4 relative">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5 mr-3">
                          <RotateCcw className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-grow pr-4">
                          <h4 className="font-medium text-blue-900">
                            Want to add recurring contributions?
                          </h4>
                          <p className="text-sm text-blue-700 mt-1">
                            You can record one-off contributions here, or set up
                            recurring contributions by clicking on any
                            individual account in your portfolio and using the
                            "Add Contribution" dialog's Recurring tab.
                          </p>
                          <Link href="/portfolio">
                            <Button
                              variant="link"
                              className="text-blue-600 h-auto p-0 mt-1"
                            >
                              Go to Portfolio →
                            </Button>
                          </Link>
                        </div>
                        <div className="flex items-center absolute top-3 right-3 space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-600 rounded-full"
                                  onClick={handleRemindLater}
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remind me later</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground rounded-full"
                                  onClick={handleHideInfoBox}
                                >
                                  <EyeOff className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Hide this message</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {[...assets]
                      .sort(
                        (a, b) =>
                          Number(b.currentValue) - Number(a.currentValue)
                      )
                      .map((asset) => (
                        <div
                          key={asset.id}
                          className="p-4 border rounded-lg bg-card"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                            {/* Column 1: Provider Logo and Information */}
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-md flex items-center justify-center mr-3">
                                {getProviderLogo(
                                  asset.platformId
                                    ? getBrokerName(
                                        asset.platformId,
                                        brokerPlatforms ?? []
                                      )
                                    : "Unknown Account"
                                )}
                              </div>
                              <div>
                                <h3 className="font-medium">
                                  {asset.platformId
                                    ? getBrokerName(
                                        asset.platformId,
                                        brokerPlatforms ?? []
                                      )
                                    : "Unknown Account"}
                                </h3>
                                <span
                                  className={`text-sm ${getAccountTypeColor(
                                    asset.accountType
                                  )}`}
                                >
                                  {asset.accountType === "LISA"
                                    ? "Lifetime ISA"
                                    : asset.accountType === "GIA"
                                    ? "General Account"
                                    : asset.accountType === "ISA"
                                    ? "Individual Savings Account"
                                    : asset.accountType}
                                </span>
                              </div>
                            </div>

                            {/* Column 2: Contribution Input */}
                            <div className="flex items-center justify-end">
                              <div className="relative md:w-1/3 w-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-muted-foreground">£</span>
                                </div>
                                <Input
                                  type="number"
                                  className="pl-7"
                                  placeholder="Enter contribution"
                                  value={contributionValues[asset.id] || ""}
                                  onChange={(e) =>
                                    handleContributionValueChange(
                                      asset.id,
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleSubmitAllContributions}
                      disabled={
                        submittingContributions ||
                        isLoading ||
                        Object.keys(contributionValues).length === 0
                      }
                      className="md:w-1/3 w-full bg-primary hover:bg-primary/90 text-white"
                    >
                      {submittingContributions ? (
                        <>
                          <span className="mr-2">Saving...</span>
                          <span className="animate-spin">⏳</span>
                        </>
                      ) : (
                        "Record Contributions"
                      )}
                    </Button>
                  </div>

                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    <p>
                      Recording your contributions helps track actual investment
                      performance separate from your deposits.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
