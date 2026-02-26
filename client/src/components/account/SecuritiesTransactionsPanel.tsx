import { BsPiggyBank } from "react-icons/bs";
import { useMemo, useState } from "react";
import {
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  SecurityTransactionUpsert,
  RecurringContributionOrphanInsert,
  RecurringContributionBulkInsert,
} from "@shared/schema";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import { useRecurringContributions } from "@/hooks/use-recurring-contributions";
import { SecurityTransactionUpsertDialogue } from "./SecurityTransactionUpsertDialogue";
import {
  RecurringContributionSecurityDialog,
  RecurringContributionSecurityTriggerButton,
} from "./RecurringContributionSecurityDialog";
import { RecurringContributionsList } from "./RecurringContributionsList";
import { Skeleton } from "../ui/skeleton";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import { AssetSecurityTransactionItem } from "./AssetSecurityTransactionItem";
import { Coins, Banknote } from "lucide-react";
import { Button } from "../ui/button";

type SecuritiesTransactionsPanelProps = {
  assetId: string;
};

export const SecuritiesTransactionsPanel = ({
  assetId,
}: SecuritiesTransactionsPanelProps) => {
  const { securities, isSecuritiesLoading } = useAssetSecurities();

  const {
    transactions,
    isTransactionsLoading,
    addSecurityTransaction,
    updateSecurityTransaction,
  } = useSecurityTransactions(assetId);

  // Recurring contributions (create only - edit/delete handled by items)
  const {
    recurringContributions,
    isLoading: isRecurringLoading,
    createRecurringContribution,
    createRecurringContributionGroup,
  } = useRecurringContributions(assetId);

  const [dialogueOpen, setDialogueOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);

  // Handlers for single transactions
  const handleCreateTransaction = async (
    securityId: string,
    data: SecurityTransactionOrphanInsert
  ): Promise<SecurityTransactionSelect> => {
    if (!assetId) throw new Error("Asset ID is required");
    try {
      const response = await addSecurityTransaction.mutateAsync({
        securityId,
        data,
      });
      setDialogueOpen(false);
      return response;
    } catch (error) {
      console.error("Error creating contribution:", error);
      throw error;
    }
  };

  const handleEditTransaction = async (
    transactionId: string,
    securityId: string,
    data: SecurityTransactionOrphanInsert
  ): Promise<SecurityTransactionSelect> => {
    try {
      const response = await updateSecurityTransaction.mutateAsync({
        securityId,
        transactionId,
        data,
      });
      setDialogueOpen(false);
      return response;
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  };

  const handleTransactionSubmit = async (
    data: SecurityTransactionUpsert
  ): Promise<SecurityTransactionSelect> => {
    const { assetSecurityId, id, ...rest } = data;

    return (
      id
        ? handleEditTransaction(id, assetSecurityId, rest)
        : handleCreateTransaction(assetSecurityId, rest)
    ).then((response) => {
      setDialogueOpen(false);
      return Promise.resolve(response);
    });
  };

  // Handlers for creating recurring contributions
  const handleCreateRecurringSingle = async (
    data: RecurringContributionOrphanInsert
  ) => {
    const result = await createRecurringContribution.mutateAsync(data);
    setRecurringDialogOpen(false);
    return result;
  };

  const handleCreateRecurringDistributed = async (
    data: RecurringContributionBulkInsert
  ) => {
    const result = await createRecurringContributionGroup.mutateAsync(data);
    setRecurringDialogOpen(false);
    return result;
  };

  const firstTransactionDate = useMemo(
    () =>
      transactions
        ? transactions.reduce((min: Date | undefined, item): Date => {
            const nextDate =
              typeof item.valueDate === "string"
                ? new Date(item.valueDate)
                : item.valueDate;

            return !min ? nextDate : nextDate < min ? nextDate : min;
          }, undefined)
        : undefined,
    [transactions]
  );

  const lastTransactionDate = useMemo(
    () =>
      transactions
        ? transactions.reduce((max: Date | undefined, item): Date => {
            const nextDate =
              typeof item.valueDate === "string"
                ? new Date(item.valueDate)
                : item.valueDate;

            return !max ? nextDate : nextDate > max ? nextDate : max;
          }, undefined)
        : undefined,
    [transactions]
  );

  const isLoading = isTransactionsLoading || isSecuritiesLoading;

  return (
    <>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <div>
          {/* Contribution Summary Section */}
          {transactions && transactions.length > 0 && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <BsPiggyBank className="h-5 w-5 mr-2 text-txn" />
                Contribution Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Number of Contributions
                  </p>
                  <p className="text-xl font-semibold">{transactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">First Transaction</p>
                  <p className="text-base font-medium">
                    {firstTransactionDate
                      ? firstTransactionDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latest Transaction</p>
                  <p className="text-base font-medium">
                    {lastTransactionDate
                      ? lastTransactionDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h2 className="text-lg font-medium">Contributions</h2>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <RecurringContributionSecurityTriggerButton
                onClick={() => setRecurringDialogOpen(true)}
              />
              <SecurityTransactionUpsertDialogue
                isOpen={dialogueOpen}
                onOpenChange={setDialogueOpen}
                onSubmit={handleTransactionSubmit}
                securities={securities}
                data={undefined}
                display="block"
              />
              <Button variant="outline" disabled={true}>
                <Banknote className="h-4 w-4" />
                Log Withdrawal
              </Button>
            </div>
          </div>

          {/* Recurring Contributions List - each item handles its own edit/delete */}
          <RecurringContributionsList
            contributions={recurringContributions}
            assetId={assetId}
            isLoading={isRecurringLoading}
          />

          {/* Single Transactions List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Transaction History
            </h3>
            {transactions?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No contributions recorded for this account.
              </div>
            )}
            {transactions?.map((transaction) => {
              return (
                <AssetSecurityTransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  securities={securities}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Create Recurring Contribution Dialog */}
      <RecurringContributionSecurityDialog
        isOpen={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
        onSubmitSingle={handleCreateRecurringSingle}
        onSubmitDistributed={handleCreateRecurringDistributed}
        securities={securities}
        data={null}
      />
    </>
  );
};
