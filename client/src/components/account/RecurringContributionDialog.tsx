import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { TransactionRecurringForm } from "./TransactionRecurringForm";
import type {
  RecurringContributionFormData,
  RecurringContribution,
} from "@shared/schema";

type RecurringContributionDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RecurringContributionFormData) => Promise<void>;
  data?: RecurringContribution | null;
};

/**
 * Dialog for creating/editing recurring contributions.
 * This is a controlled dialog - use the trigger button separately.
 */
export const RecurringContributionDialog = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
}: RecurringContributionDialogProps) => {
  const handleSubmit = async (formData: RecurringContributionFormData) => {
    await onSubmit(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data ? "Edit Recurring Contribution" : "Add Recurring Contribution"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? "Update the schedule for this recurring contribution."
              : "Set up a recurring contribution to automatically track regular investments."}
          </DialogDescription>
        </DialogHeader>

        <TransactionRecurringForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          data={data ?? undefined}
        />
      </DialogContent>
    </Dialog>
  );
};

/**
 * Button to trigger opening the recurring contribution dialog in create mode.
 */
export const RecurringContributionTriggerButton = ({
  onClick,
}: {
  onClick: () => void;
}) => (
  <Button
    variant="outline"
    size="sm"
    className="flex items-center"
    onClick={onClick}
  >
    <CalendarClock className="w-4 h-4 mr-2" />
    Add Recurring
  </Button>
);
