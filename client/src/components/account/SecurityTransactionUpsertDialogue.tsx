import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionRecurringForm } from "./TransactionRecurringForm";
import {
  isAssetContribution,
  isRecurringContribution,
} from "@shared/schema/transaction";
import { TransactionSingleForm } from "./TransactionSingleForm";
import type {
  SecurityTransactionInsert,
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  SecurityTransactionUpsert,
  RecurringContribution,
  AssetTransaction,
  UserAssetSecuritySelect,
  RecurringContributionFormData,
  AssetContributionFormData,
} from "@shared/schema";
import { useCallback } from "react";
import { SecurityTransactionSingleForm } from "./SecurityTransactionSingleForm";

type SecurityTransactionUpsertDialogueProps<
  S extends (
    data: SecurityTransactionUpsert
  ) => Promise<SecurityTransactionSelect> = (
    data: SecurityTransactionUpsert
  ) => Promise<SecurityTransactionSelect>,
  D extends SecurityTransactionSelect | null = SecurityTransactionSelect | null
> = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: S;
  data?: D;
  securities: UserAssetSecuritySelect[];
  display: "inline" | "block";
};

export const SecurityTransactionUpsertDialogue = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
  securities,
  display = "block",
}: SecurityTransactionUpsertDialogueProps) => {
  // Form for adding/editing contributions

  const handleTransactionSubmit = useCallback(
    async (data: SecurityTransactionUpsert): Promise<void> => {
      console.log("SSS handleTransactionSubmit data", data);
      //console.log("handleTransactionSubmit transactionId", transactionId);
      //if (!onSubmit) return;
      await onSubmit(data);
      if (onOpenChange) {
        onOpenChange(false);
      }
      console.log("SSS handleTransactionSubmit done");
      return Promise.resolve();
    },
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {display === "inline" ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Contribution
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {data ? "Edit Contribution" : "Add Contribution"}
          </DialogTitle>
          <DialogDescription>
            Record a new transaction to this account.
          </DialogDescription>
        </DialogHeader>
        <SecurityTransactionSingleForm
          onSubmit={handleTransactionSubmit}
          securities={securities}
          data={
            data
              ? {
                  value: data.value,
                  currencyValue: data.currencyValue,
                  valueDate: data.valueDate,
                  assetSecurityId: data.assetSecurityId,
                }
              : undefined
          }
          CancelButton={
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
