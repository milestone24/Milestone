import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionRecurringForm } from "./TransactionRecurringForm";
import {
  RecurringContributionFormData,
  SingleContributionFormData,
  isAssetContribution,
  isRecurringContribution,
} from "@shared/schema/contribution";
import { TransactionSingleForm } from "./TransactionSingleForm";
import {
  AssetTransaction,
  UserAssetSecuritySelect,
} from "@shared/schema/portfolio-assets";
import { RecurringContribution } from "@shared/schema/portfolio-assets";
import {
  SecurityTransactionInsert,
  SecurityTransactionOrphanInsert,
  SecurityTransactionSelect,
  SecurityTransactionUpsert,
} from "@shared/schema/securities";
import { useCallback } from "react";
import { SecurityTransactionSingleForm } from "./SecurityTransactionSingleForm";

type SecurityTransactionUpsertDialogueProps<
  S extends (
    data: SecurityTransactionUpsert
  ) => Promise<SecurityTransactionSelect> = (
    data: SecurityTransactionUpsert
  ) => Promise<SecurityTransactionSelect>,
  D extends SecurityTransactionSelect | null = SecurityTransactionSelect | null
> =
  | {
      isOpen: true;
      onOpenChange: (open: boolean) => void;
      onSubmit: S;
      data?: D;
      securities: UserAssetSecuritySelect[];
    }
  | {
      isOpen: false;
      onOpenChange?: (open: boolean) => void;
      onSubmit?: S;
      data?: D;
      securities: UserAssetSecuritySelect[];
    };

export const SecurityTransactionUpsertDialogue = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
  securities,
}: SecurityTransactionUpsertDialogueProps) => {
  // Form for adding/editing contributions

  const handleTransactionSubmit = useCallback(
    async (data: SecurityTransactionInsert) => {
      console.log("SSS handleTransactionSubmit data", data);
      //console.log("handleTransactionSubmit transactionId", transactionId);
      if (!onSubmit) return;
      onSubmit(data);
    },
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          {"Add Contribution"}
        </Button>
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
        />
      </DialogContent>
    </Dialog>
  );
};
