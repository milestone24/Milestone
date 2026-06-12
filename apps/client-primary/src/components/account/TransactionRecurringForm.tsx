import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLens } from "@hookform/lenses";
import type { RecurringContributionFormData } from "@milestone/js-common/schema/transaction";
import {
  recurringContributionOrphanInsertSchemaBase,
  createDecimalValueString,
} from "@milestone/js-common/schema";
import { Form } from "@/components/ui/form";
import { Button } from "../ui/button";
import { RecurringContribution } from "@milestone/js-common/schema";
import { Loader2 } from "lucide-react";
import { RecurringContributionFields } from "./RecurringContributionFields";

type TransactionRecurringFormProps = {
  onSubmit: (data: RecurringContributionFormData) => void;
  onCancel?: () => void;
  data?: RecurringContribution;
};

const defaultValues: RecurringContributionFormData = {
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
};

/**
 * Transform DB data to form data format
 * Ensures startDate is a Date object
 */
const transformToFormData = (
  data: RecurringContribution
): RecurringContributionFormData => ({
  amount: data.amount,
  startDate:
    data.startDate instanceof Date ? data.startDate : new Date(data.startDate),
  patternConfig: data.patternConfig,
  process: data.process,
  notificationEmail: data.notificationEmail,
  notificationPush: data.notificationPush,
  isActive: data.isActive,
});

export const TransactionRecurringForm = ({
  onSubmit,
  onCancel,
  data,
}: TransactionRecurringFormProps) => {
  // Transform data when editing to ensure proper types
  const formValues = useMemo(() => {
    if (!data) return defaultValues;
    return transformToFormData(data);
  }, [data]);

  const form = useForm<RecurringContributionFormData>({
    resolver: zodResolver(recurringContributionOrphanInsertSchemaBase),
    values: formValues,
    defaultValues: defaultValues,
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = form;

  // Create lens from control for the shared component
  const lens = useLens({ control });

  return (
    <>
      {!data ? (
        <div className="my-4">
          <p className="text-center text-sm text-muted-foreground">
            Set up recurring contributions to automatically track regular
            investments to your portfolio.
          </p>
        </div>
      ) : null}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <RecurringContributionFields lens={lens} />
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {data
                ? isSubmitting
                  ? "Updating Contribution..."
                  : "Update Contribution"
                : isSubmitting
                ? "Adding Contribution..."
                : "Add Contribution"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};
