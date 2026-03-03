import { UseFormReturn } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FireSettingsForm, FireSettingsFormValues } from "./FireSettingsForm";

type FireSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<FireSettingsFormValues>;
  onSave: () => void;
  isSubmitting: boolean;
};

export const FireSettingsDialog = ({
  open,
  onOpenChange,
  form,
  onSave,
  isSubmitting,
}: FireSettingsDialogProps) => {
  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">FIRE Settings</DialogTitle>
        </DialogHeader>
        <Separator />
        <Form {...form}>
          <FireSettingsForm />
        </Form>
        <Separator />
        <DialogFooter className="gap-3 sm:gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={onSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
