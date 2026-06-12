import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AccountType, Milestone, createDecimalValueString } from "@milestone/js-common/schema";
import { useMilestoneUpdate } from "@/hooks/use-milestone-update";
import { useAssets } from "@/hooks/use-assets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Button } from "@/components/ui/button";
import { Alert } from "../ui/alert";
import { AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";
const editMilestoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accountType: z.string().optional(),
  targetValue: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Target value must be a positive number",
    }),
});

type EditMilestoneFormData = z.infer<typeof editMilestoneSchema>;

interface EditMilestoneDialogProps {
  milestone: Milestone;
  isOpen: boolean;
  onClose: () => void;
}

export function EditMilestoneDialog({
  milestone,
  isOpen,
  onClose,
}: EditMilestoneDialogProps) {
  const updateMilestone = useMilestoneUpdate();
  const { data: assets = [] } = useAssets();

  // Get the unique account types that exist in the user's portfolio
  const availableAccountTypes = useMemo(() => {
    const types = new Set<AccountType | "ALL">();
    types.add("ALL"); // Always include "ALL" as an option

    assets.forEach((asset) => {
      if (asset.accountType) {
        types.add(asset.accountType as AccountType);
      }
    });

    return Array.from(types);
  }, [assets]);

  const form = useForm<EditMilestoneFormData>({
    resolver: zodResolver(editMilestoneSchema),
    defaultValues: {
      name: milestone.name,
      accountType: milestone.accountType || "ALL",
      targetValue: milestone.targetValue.toString(),
    },
  });

  const onSubmit = async (values: EditMilestoneFormData) => {
    try {
      await updateMilestone.mutateAsync({
        id: milestone.id,
        name: values.name,
        accountType: values.accountType === "ALL" ? null : values.accountType,
        targetValue: createDecimalValueString(values.targetValue),
      });
      onClose();
    } catch (error) {
      // Error handling is managed by the mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
          <DialogDescription>
            Update your investment milestone details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Milestone name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {assets.length === 0 ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please add at least one account in the Portfolio section
                  before creating milestones.
                </AlertDescription>
              </Alert>
            ) : (
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={assets.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* Only show account types that exist in the user's portfolio */}
                        {availableAccountTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type === "ALL" ? "All accounts (portfolio)" : type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="targetValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Value (£)</FormLabel>
                  <FormControl>
                    <DecimalInput
                      ref={field.ref}
                      value={field.value ?? undefined}
                      decimalScale={2}
                      placeholder="Enter target value"
                      onBlur={field.onBlur}
                      disabled={field.disabled}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMilestone.isPending || assets.length === 0}
              >
                {updateMilestone.isPending
                  ? "Saving..."
                  : assets.length === 0
                  ? "Add accounts first"
                  : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
