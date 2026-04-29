import type { AssetTransaction } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Coins, Pencil, Trash2 } from "lucide-react";
import { TransactionSourceBadges } from "./TransactionSourceBadges";

type AssetCashTransactionItemProps = {
  transaction: AssetTransaction;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
};

export const AssetCashTransactionItem = ({
  transaction,
  onEdit,
  onDelete,
  className,
}: AssetCashTransactionItemProps) => {
  const amount = Number(transaction.currencyValue);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-muted rounded-lg",
        className
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <Coins className="h-4 w-4 text-txn" />
          <span className="text-sm text-muted-foreground">Cash movement</span>
          <span className="text-muted-foreground">·</span>
          <span
            className={cn(
              "font-semibold",
              amount > 0 ? "text-positive" : "text-negative"
            )}
          >
            {amount > 0 ? "+" : "-"}£{Math.abs(amount).toLocaleString()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <TransactionSourceBadges
            source={transaction.source}
            flags={transaction.flags}
          />
          <span>
            {new Date(transaction.valueDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
