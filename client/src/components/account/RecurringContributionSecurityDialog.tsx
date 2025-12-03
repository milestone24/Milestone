import { useState, useCallback, useEffect } from "react";
import { useForm, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLens } from "@hookform/lenses";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  RecurringContribution,
  RecurringContributionOrphanInsert,
  RecurringContributionBulkInsert,
  UserAssetSecuritySelect,
  createDecimalValueString,
  recurringContributionOrphanInsertSchemaBase,
} from "@shared/schema";
import { RecurringContributionFields } from "./RecurringContributionFields";
import type { RecurringContributionFormData } from "@shared/schema/transaction";

type ContributionMode = "single" | "distributed";

type SecurityDistributionItem = {
  securityId: string;
  securityName: string;
  commitment: string;
};

// Extended form data that includes mode and security selection
type RecurringContributionSecurityFormData = RecurringContributionFormData & {
  mode: ContributionMode;
  selectedSecurityId?: string;
  securityDistribution: SecurityDistributionItem[];
};

const formSchema = recurringContributionOrphanInsertSchemaBase.extend({
  mode: z.enum(["single", "distributed"]),
  selectedSecurityId: z.string().optional(),
  securityDistribution: z.array(
    z.object({
      securityId: z.string(),
      securityName: z.string(),
      commitment: z.string(),
    })
  ),
});

type RecurringContributionSecurityDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSingle: (
    data: RecurringContributionOrphanInsert
  ) => Promise<RecurringContribution>;
  onSubmitDistributed: (
    data: RecurringContributionBulkInsert
  ) => Promise<RecurringContribution[]>;
  securities: UserAssetSecuritySelect[];
  data?: RecurringContribution | null;
};

const getDefaultValues = (
  securities: UserAssetSecuritySelect[]
): RecurringContributionSecurityFormData => ({
  amount: createDecimalValueString("0"),
  startDate: new Date(),
  patternConfig: {
    type: "rrule",
    expression: "FREQ=MONTHLY;BYMONTHDAY=1",
  },
  process: "manual",
  notificationEmail: false,
  notificationPush: false,
  isActive: true,
  mode: securities.length === 1 ? "single" : "distributed",
  selectedSecurityId: securities.length === 1 ? securities[0]?.id : undefined,
  securityDistribution: securities.map((s) => ({
    securityId: s.id,
    securityName: s.security.name,
    commitment:
      securities.length > 0 ? (100 / securities.length).toFixed(0) : "0",
  })),
});

/**
 * Transform existing recurring contribution to form data for editing
 */
const getEditValues = (
  data: RecurringContribution,
  securities: UserAssetSecuritySelect[]
): RecurringContributionSecurityFormData => ({
  amount: data.amount,
  startDate:
    data.startDate instanceof Date ? data.startDate : new Date(data.startDate),
  patternConfig: data.patternConfig,
  process: data.process,
  notificationEmail: data.notificationEmail,
  notificationPush: data.notificationPush,
  isActive: data.isActive,
  // Edit mode is always single since we're editing a specific contribution
  mode: "single",
  selectedSecurityId: data.securityId ?? undefined,
  securityDistribution: securities.map((s) => ({
    securityId: s.id,
    securityName: s.security.name,
    commitment:
      securities.length > 0 ? (100 / securities.length).toFixed(0) : "0",
  })),
});

export const RecurringContributionSecurityDialog = ({
  isOpen,
  onOpenChange,
  onSubmitSingle,
  onSubmitDistributed,
  securities,
  data,
}: RecurringContributionSecurityDialogProps) => {
  const form = useForm<RecurringContributionSecurityFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(securities),
    mode: "onBlur",
  });

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = form;

  const mode = watch("mode");
  const selectedSecurityId = watch("selectedSecurityId");
  const securityDistribution = watch("securityDistribution");

  // Reset form when dialog opens - populate with edit data or defaults
  useEffect(() => {
    if (isOpen) {
      if (data) {
        reset(getEditValues(data, securities));
      } else {
        reset(getDefaultValues(securities));
      }
    }
  }, [isOpen, securities, data, reset]);

  // Create lens for the shared fields component
  const lens = useLens({ control });

  const handleFormSubmit = async (
    formData: RecurringContributionSecurityFormData
  ) => {
    const { mode, selectedSecurityId, securityDistribution, ...baseData } =
      formData;

    try {
      if (mode === "single") {
        if (!selectedSecurityId) {
          throw new Error("Please select a security");
        }
        await onSubmitSingle({
          ...baseData,
          type: "security",
          securityId: selectedSecurityId,
        });
      } else {
        // Distributed mode
        await onSubmitDistributed({
          ...baseData,
          securityDistribution: securityDistribution.map((s) => ({
            securityId: s.securityId,
            commitment: createDecimalValueString(s.commitment),
          })),
        });
      }
      onOpenChange(false);
      reset(getDefaultValues(securities));
    } catch (error) {
      console.error("Error saving recurring contribution:", error);
      throw error;
    }
  };

  // Calculate total commitment percentage
  const totalCommitment = securityDistribution.reduce(
    (sum, s) => sum + (Number(s.commitment) || 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data
              ? "Edit Recurring Contribution"
              : "Add Recurring Contribution"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? "Update the schedule for this recurring contribution."
              : "Set up a recurring contribution for your securities."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="flex flex-col gap-6"
          >
            {/* Mode Selection - only show if multiple securities */}
            {securities.length > 1 && (
              <FormField
                control={control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contribution Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-3"
                      >
                        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem
                            value="single"
                            id="mode-single"
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-0.5">
                            <label
                              htmlFor="mode-single"
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              Single Security
                            </label>
                            <span className="text-xs text-muted-foreground">
                              Contribute to one specific security
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem
                            value="distributed"
                            id="mode-distributed"
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-0.5">
                            <label
                              htmlFor="mode-distributed"
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              Distributed
                            </label>
                            <span className="text-xs text-muted-foreground">
                              Split across multiple securities
                            </span>
                          </div>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Single Security Selection */}
            {mode === "single" && (
              <FormField
                control={control}
                name="selectedSecurityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Security</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a security" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {securities.map((security) => (
                          <SelectItem key={security.id} value={security.id}>
                            {security.security.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The recurring contribution will be applied to this
                      security only.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Distributed Security Distribution */}
            {mode === "distributed" && securities.length > 1 && (
              <div className="space-y-4">
                <div>
                  <FormLabel>Distribution Percentage</FormLabel>
                  <FormDescription className="mt-1">
                    Set the percentage of the total contribution for each
                    security. The total should equal 100%.
                  </FormDescription>
                </div>
                <div className="space-y-3">
                  {securityDistribution.map((item, index) => (
                    <div
                      key={item.securityId}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border"
                    >
                      <span className="flex-1 text-sm font-medium truncate">
                        {item.securityName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          className="w-20"
                          value={item.commitment}
                          onChange={(e) => {
                            const newDistribution = [...securityDistribution];
                            newDistribution[index] = {
                              ...item,
                              commitment: e.target.value,
                            };
                            setValue("securityDistribution", newDistribution);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={`text-sm font-medium p-2 rounded ${
                    totalCommitment === 100
                      ? "text-green-700 bg-green-50"
                      : "text-red-700 bg-red-50"
                  }`}
                >
                  Total: {totalCommitment}%
                  {totalCommitment !== 100 && " (must equal 100%)"}
                </div>
              </div>
            )}

            {/* Shared Recurring Contribution Fields */}
            <RecurringContributionFields
              lens={lens as any}
              showStartDate={true}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (mode === "distributed" && totalCommitment !== 100) ||
                  (mode === "single" && !selectedSecurityId)
                }
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {data ? "Update Contribution" : "Add Contribution"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Button to trigger opening the recurring contribution security dialog.
 */
export const RecurringContributionSecurityTriggerButton = ({
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

