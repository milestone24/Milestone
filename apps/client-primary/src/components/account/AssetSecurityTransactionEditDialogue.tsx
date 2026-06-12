import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import type {
  SecurityTransactionSelect,
  SecurityTransactionUpsert,
  UserAssetSecuritySelect,
} from "@milestone/js-common/schema";
import { useCallback } from "react";
import { AssetSecurityTransactionSingleForm } from "./AssetSecurityTransactionSingleForm";

type AssetSecurityTransactionEditDialogueProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (
    data: SecurityTransactionUpsert,
    linkCash?: boolean,
  ) => Promise<SecurityTransactionSelect>;
  data: SecurityTransactionSelect;
  securities: UserAssetSecuritySelect[];
  display: "inline" | "block";
};

export const AssetSecurityTransactionEditDialogue = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
  securities,
  display = "block",
}: AssetSecurityTransactionEditDialogueProps) => {
  // Form for adding/editing contributions

  const handleTransactionSubmit = useCallback(
    async (data: SecurityTransactionUpsert): Promise<void> => {
      await onSubmit(data);
      if (onOpenChange) {
        onOpenChange(false);
      }
      console.log("SSS handleTransactionSubmit done");
      return Promise.resolve();
    },
    [],
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
            Add Transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Edit Transactions"}</DialogTitle>
          <DialogDescription>
            Record a new transaction to this account.
          </DialogDescription>
        </DialogHeader>

        <AssetSecurityTransactionSingleForm
          onSubmit={handleTransactionSubmit}
          securities={securities}
          data={data}
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
