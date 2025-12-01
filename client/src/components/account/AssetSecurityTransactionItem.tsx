import {
  SecurityTransactionSelect,
  SecurityTransactionUpsert,
  UserAssetSecuritySelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { cn } from "@/lib/utils";
import { Layers2, Loader2, Trash2 } from "lucide-react";
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
import { Button } from "../ui/button";
import { useCallback, useState } from "react";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import { useAsset } from "@/hooks/use-asset";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import { SecurityTransactionSingleForm } from "./SecurityTransactionSingleForm";
import { SecurityTransactionUpsertDialogue } from "./SecurityTransactionUpsertDialogue";

type AssetSecurityTransactionItemProps = {
  transaction: UserAssetSecurityTransactionResolved;
  securities: UserAssetSecuritySelect[];
};

export const AssetSecurityTransactionItem = ({
  transaction,
  securities,
}: AssetSecurityTransactionItemProps) => {
  const [isInProcess, setIsInProcess] = useState(false);

  const { assetId } = useAssetSecurities();
  const { deleteSecurityTransaction } = useSecurityTransactions(assetId);
  const { updateSecurityTransaction } = useSecurityTransactions(assetId);
  const [error, setError] = useState<Error | null>(null);

  const handleDeleteTransaction = useCallback(
    async ({
      assetSecurityId,
      transactionId,
    }: {
      assetSecurityId: string;
      transactionId: string;
    }) => {
      console.log("handleDeleteTransaction", {
        assetSecurityId,
        transactionId,
      });

      try {
        setIsInProcess(true);
        await deleteSecurityTransaction.mutateAsync({
          assetSecurityId,
          transactionId,
        });
        setIsInProcess(false);
      } catch (error) {
        console.error("Error deleting transaction:", error);
        setError(error as Error);
      }
    },
    [deleteSecurityTransaction, setIsInProcess]
  );

  const handleTransactionSubmit = useCallback(
    async (data: SecurityTransactionUpsert) => {
      const response = await updateSecurityTransaction.mutateAsync({
        securityId: transaction.assetSecurityId,
        transactionId: transaction.id,
        data,
      });
      console.log("handleTransactionSubmit", data);
      return Promise.resolve(transaction);
    },
    [transaction]
  );

  return (
    <div
      key={transaction.id}
      className={cn(
        "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-gray-50 rounded-lg transition-opacity",
        isInProcess && "opacity-50 pointer-events-none"
      )}
    >
      {/* Content Section */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <Layers2 className="h-4 w-4 text-green-600" />
          <span className="text-sm text-muted-foreground">
            {transaction.securityName}
          </span>
          <span className="text-muted-foreground">·</span>
          <span
            className={cn(
              "font-semibold",
              Number(transaction.value) > 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {Number(transaction.value) > 0 ? "+" : ""}
            {Number(transaction.value)} shares
          </span>
          {isInProcess && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(transaction.valueDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          £{transaction.currencyValue.toLocaleString()}
        </p>
      </div>

      {/* Actions Section */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        <SecurityTransactionUpsertDialogue
          onSubmit={handleTransactionSubmit}
          data={transaction}
          securities={securities}
          display="inline"
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={isInProcess}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Transaction</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this transaction? If you
                continue please be aware it may take a few minutes to update the
                history.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() =>
                  handleDeleteTransaction({
                    assetSecurityId: transaction.assetSecurityId,
                    transactionId: transaction.id,
                  })
                }
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error.message}</p>}
    </div>
  );
};
