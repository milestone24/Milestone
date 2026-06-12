import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AssetContributionFormData,
  AssetTransaction,
} from "@milestone/js-common/schema";
import { TransactionSingleForm } from "./TransactionSingleForm";

type TransactionsDialogueProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: AssetContributionFormData,
    contributionId?: string
  ) => Promise<void>;
  data?: AssetTransaction | null;
};

/**
 * Dialog for creating/editing single contributions.
 * This is a controlled dialog - use the trigger button separately.
 */
export const TransactionsDialogue = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
}: TransactionsDialogueProps) => {
  const handleSubmit = async (values: AssetContributionFormData) => {
    await onSubmit(values, data?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {data ? "Edit Contribution" : "Add Contribution"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? "Update this contribution record."
              : "Record a new contribution to this account."}
          </DialogDescription>
        </DialogHeader>

        <TransactionSingleForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          data={
            data
              ? {
                  value: data.value,
                  valueDate: new Date(data.valueDate),
                }
              : undefined
          }
        />
      </DialogContent>
    </Dialog>
  );
};
