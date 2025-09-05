// @ts-nocheck

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
import { History, Edit, Check, X } from "lucide-react";
import { usePortfolio } from "@/context/PortfolioContext";
import { useToast } from "@/hooks/use-toast";
import { AssetValue } from "@shared/schema";

type AccountFormData = {
  [key: string]: string;
};

export default function Record() {
  const { assets, addBrokerAssetValue, isLoading, accountsHistory } =
    usePortfolio();

  const { toast } = useToast();
  const [accountValues, setAccountValues] = useState<AccountFormData>({});
  const [date, setDate] = useState<string>(
    /** @ts-ignore */
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [updatingAccounts, setUpdatingAccounts] = useState<string[]>([]);

  // History dialog states
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editHistoryRecord, setEditHistoryRecord] =
    useState<AccountHistory | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [allHistory, setAllHistory] = useState<AccountHistory[]>([]);

  // Flatten all account history into a single array for the history dialog
  useEffect(() => {
    if (accountsHistory) {
      const flattenedHistory = accountsHistory.flatMap(
        (account) => account.history
      );
      // Sort by most recent first
      flattenedHistory.sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      setAllHistory(flattenedHistory);
    }
  }, [accountsHistory]);

  // Find account name by ID
  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account
      ? `${account.provider} (${account.accountType})`
      : "Unknown Account";
  };

  // Start editing a history record
  const handleEditRecord = (record: AccountHistory) => {
    setEditHistoryRecord(record);
    setEditValue(record.value);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditHistoryRecord(null);
    setEditValue("");
  };

  // Save edited record
  const handleSaveEdit = async () => {
    if (!editHistoryRecord) return;

    try {
      // This would need an update function in the PortfolioContext/API
      // For now, we'll just show a toast indicating what would happen
      toast({
        title: "Update history functionality",
        description: `Value would be updated from ${editHistoryRecord.value} to ${editValue}`,
      });

      setEditHistoryRecord(null);
      setEditValue("");
    } catch (error) {
      console.error("Error updating history record:", error);
      toast({
        title: "Error",
        description: "Failed to update history record. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle input change for account values
  const handleAccountValueChange = (accountId: string, value: string) => {
    setAccountValues((prev) => ({
      ...prev,
      [accountId]: value,
    }));
  };

  // Handle form submission for a single account
  const handleSubmitAccount = async (accountId: string) => {
    const value = accountValues[accountId];

    if (!value || !date) {
      toast({
        title: "Missing information",
        description: "Please enter a value for this account",
        variant: "destructive",
      });
      return;
    }

    setUpdatingAccounts((prev) => [...prev, accountId]);

    try {
      await addAccountHistory({
        accountId,
        value,
        recordedAt: new Date(date),
      });

      toast({
        title: "Value recorded",
        description: "Account value has been updated successfully",
      });

      // Clear the value for this account
      setAccountValues((prev) => {
        const newValues = { ...prev };
        delete newValues[accountId];
        return newValues;
      });
    } catch (error) {
      console.error("Error recording value:", error);
      toast({
        title: "Error",
        description: "Failed to record value. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingAccounts((prev) => prev.filter((id) => id !== accountId));
    }
  };

  // Handle submission of all accounts at once
  const handleSubmitAll = async () => {
    const accountsToUpdate = Object.entries(accountValues)
      .filter(([_, value]) => value.trim() !== "")
      .map(([id, value]) => ({
        accountId: id,
        value,
        recordedAt: new Date(date),
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
      // Update each account sequentially
      for (const accountData of accountsToUpdate) {
        await addAccountHistory(accountData);
      }

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

  return (
    <div className="record-screen max-w-5xl mx-auto px-4 pb-20">
      <Card className="mt-4">
        <CardHeader className="relative">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold">
              Record Account Values
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHistoryOpen(true)}
              title="View History"
            >
              <History className="h-5 w-5" />
            </Button>
          </div>
          <CardDescription>
            Update the value of your accounts to keep track of your investments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label htmlFor="date" className="block text-sm font-medium mb-1">
              Date for All Entries
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full md:w-1/3"
            />
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">
                You don't have any accounts yet. Add accounts in the Portfolio
                section.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {[...accounts]
                  .sort(
                    (a, b) => Number(b.currentValue) - Number(a.currentValue)
                  )
                  .map((account) => (
                    <div
                      key={account.id}
                      className="p-4 border rounded-lg bg-card"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                        {/* Column 1: Account Information */}
                        <div>
                          <h3 className="font-medium">{account.provider}</h3>
                          <p className="text-sm text-muted-foreground">
                            {account.accountType}
                          </p>
                        </div>

                        {/* Column 2: Current Value */}
                        <div className="text-center">
                          <h3 className="font-medium">Current Value</h3>
                          <p className="text-sm text-muted-foreground">
                            £{parseInt(account.currentValue).toLocaleString()}
                          </p>
                        </div>

                        {/* Column 3: New Value Input & Update Button */}
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500">£</span>
                            </div>
                            <Input
                              type="number"
                              className="pl-7"
                              placeholder="Enter new value"
                              value={accountValues[account.id] || ""}
                              onChange={(e) =>
                                handleAccountValueChange(
                                  account.id,
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <Button
                            onClick={() => handleSubmitAccount(account.id)}
                            disabled={
                              !accountValues[account.id] ||
                              updatingAccounts.includes(account.id) ||
                              isLoading
                            }
                            className="whitespace-nowrap"
                            size="sm"
                          >
                            {updatingAccounts.includes(account.id)
                              ? "Updating..."
                              : "Update"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="mt-6">
                <Button
                  onClick={handleSubmitAll}
                  disabled={
                    submitting ||
                    isLoading ||
                    Object.keys(accountValues).length === 0
                  }
                  className="w-full bg-primary text-white"
                >
                  {submitting ? "Recording All Values..." : "Record All Values"}
                </Button>
              </div>
            </>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Regularly updating your account values helps you track your
              progress and keeps your portfolio data accurate.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Account Value History</DialogTitle>
            <DialogDescription>
              View and manage all recorded account values.
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No history records found.
                  </TableCell>
                </TableRow>
              ) : (
                allHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{getAccountName(record.accountId)}</TableCell>
                    <TableCell>
                      {new Date(record.recordedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {editHistoryRecord?.id === record.id ? (
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500">£</span>
                          </div>
                          <Input
                            type="number"
                            className="pl-7"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                        </div>
                      ) : (
                        <>£{parseInt(record.value).toLocaleString()}</>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editHistoryRecord?.id === record.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleSaveEdit}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditRecord(record)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
