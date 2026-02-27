import { UseFormReturn } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>FIRE Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <FireSettingsForm />
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
