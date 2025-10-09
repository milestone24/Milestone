import {
  SecurityTransactionSelect,
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

type AssetSecurityTransactionItemProps = {
  transaction: UserAssetSecurityTransactionResolved;
};

export const AssetSecurityTransactionItem = ({
  transaction,
}: AssetSecurityTransactionItemProps) => {
  const [isInProcess, setIsInProcess] = useState(false);

  const { assetId } = useAssetSecurities();
  const { deleteSecurityTransaction } = useSecurityTransactions(assetId);
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

  return (
    <div
      key={transaction.id}
      className="flex flex-row justify-between items-center p-2 md:p-4 bg-gray-50"
    >
      <div>
        <div className="flex items-center">
          {/* Replace this with icon for security shares */}
          <Layers2 className="h-4 w-4 mr-1 text-green-600" />
          {/* <Coins className="h-4 w-4 mr-1 text-green-600" /> */}
          <span className="text-sm text-gray-600 pl-1">
            {transaction.securityName}&nbsp;-&nbsp;
          </span>
          <span
            className={cn(
              "font-medium",
              transaction.value > 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {transaction.value > 0 ? "+" : "-"}
            {Number(transaction.value)} shares
          </span>
        </div>
        <p className="text-sm text-gray-600">
          <span>
            {new Date(transaction.valueDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>&nbsp;-&nbsp;</span>
          <span>£{transaction.currencyValue.toLocaleString()}</span>
        </p>
      </div>
      <div>
        {isInProcess ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Dialog>
            <DialogTrigger>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mr-2 text-red-600 hover:text-red-800 hover:bg-red-50"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Transaction</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this transaction? If you
                  continue please be aware it may take a few minutes to update
                  the history
                </DialogDescription>
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
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {error && <p className="text-red-500">{error.message}</p>}
    </div>
  );
};
