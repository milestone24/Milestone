import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AssetValue, createDecimalValueString } from "@shared/schema";
import { useAssetValues } from "@/hooks/use-asset-values";

const assetValueSchema = z.object({
  value: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Value must be a positive number",
  }),
  valueDate: z.coerce.date(),
});

type AssetValueFormData = z.infer<typeof assetValueSchema>;

type AssetValueUpsertDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: AssetValue | null;
  assetId: string;
};

export const AssetValueUpsertDialog = ({
  isOpen,
  onOpenChange,
  data,
  assetId,
}: AssetValueUpsertDialogProps) => {
  const { addAssetValue, updateAssetValue } = useAssetValues(assetId);

  const isEditMode = data !== null;

  const form = useForm<AssetValueFormData>({
    resolver: zodResolver(assetValueSchema),
    defaultValues: {
      value: "",
      valueDate: new Date(),
    },
  });

  // Reset form when dialog opens or data changes
  useEffect(() => {
    if (isOpen) {
      if (data) {
        form.reset({
          value: data.value.toString(),
          valueDate: new Date(data.valueDate),
        });
      } else {
        form.reset({
          value: "",
          valueDate: new Date(),
        });
      }
    }
  }, [isOpen, data, form]);

  const handleSubmit = async (values: AssetValueFormData) => {
    try {
      if (isEditMode) {
        await updateAssetValue.mutateAsync({
          historyId: data.id,
          value: createDecimalValueString(values.value),
          valueDate: values.valueDate,
          recordedAt: new Date(),
        });
      } else {
        await addAssetValue.mutateAsync({
          value: createDecimalValueString(values.value),
          valueDate: values.valueDate,
          recordedAt: new Date(),
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving asset value:", error);
    }
  };

  const isPending = addAssetValue.isPending || updateAssetValue.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit History Entry" : "Add History Entry"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the value and date of this history entry."
              : "Add a new value record for this account."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter value"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    disabled={field.disabled}
                    max={new Date()}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditMode ? "Updating..." : "Adding..."}
                  </>
                ) : isEditMode ? (
                  "Update Entry"
                ) : (
                  "Add Entry"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

