import { BsPiggyBank } from "react-icons/bs";
import { Coins, Layers2, Loader2, Plus, Share, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  SecurityTransactionInsert,
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  SecurityTransactionUpsert,
} from "@shared/schema";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import { cn } from "@/lib/utils";
import { useAsset } from "@/hooks/use-asset";
import { SecurityTransactionUpsertDialogue } from "./SecurityTransactionUpsertDialogue";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { AssetSecurityTransactionItem } from "./AssetSecurityTransactionItem";

type SecuritiesTransactionsPanelProps = {
  assetId: string;
};

export const SecuritiesTransactionsPanel = ({
  assetId,
}: SecuritiesTransactionsPanelProps) => {
  const { securities, addSecurity, isSecuritiesLoading } = useAssetSecurities();

  const {
    transactions,
    isTransactionsLoading,
    addSecurityTransaction,
    updateSecurityTransaction,
  } = useSecurityTransactions(assetId);

  const [dialogueOpen, setDialogueOpen] = useState(false);

  // Handlers for contributions
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

  const [transactionsInProcess, setTransactionsInProcess] = useState<string[]>(
    []
  );

  const handleTransactionSubmit = async (
    data: SecurityTransactionUpsert
  ): Promise<SecurityTransactionSelect> => {
    const { assetSecurityId, id, ...rest } = data;

    return id
      ? handleEditTransaction(id, assetSecurityId, rest)
      : handleCreateTransaction(assetSecurityId, rest);
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

  const isLoading = isTransactionsLoading;

  return (
    <>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <div>
          {/* Contribution Summary Section */}
          {transactions && transactions.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <BsPiggyBank className="h-5 w-5 mr-2 text-green-600" />
                Contribution Summary
              </h3>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-sm text-gray-600">
                    Number of Contributions
                  </p>
                  <p className="text-xl font-semibold">{transactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">First Transaction</p>
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
                  <p className="text-sm text-gray-600">Latest Transaction</p>
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
          <div className="space-y-4">
            {transactions?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No contributions recorded for this account.
              </div>
            )}
            <div className="flex justify-end">
              <SecurityTransactionUpsertDialogue
                isOpen={dialogueOpen}
                onOpenChange={setDialogueOpen}
                onSubmit={handleTransactionSubmit}
                securities={securities}
                data={undefined}
              />
            </div>
            {transactions?.map((transaction) => {
              return (
                <AssetSecurityTransactionItem
                  key={transaction.id}
                  transaction={transaction}
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
