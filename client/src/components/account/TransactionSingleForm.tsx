import { zodResolver } from "@hookform/resolvers/zod";
import {
  AssetContributionFormData,
  assetContributionOrphanInsertSchema,
} from "@shared/schema/transaction";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { DateInput } from "../ui/date-input";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { withTransform } from "@/lib/utils/mappers";
import Decimal from "decimal.js";

type TransactionSingleFormProps = {
  onSubmit: (data: AssetContributionFormData) => Promise<void>;
  onCancel?: () => void;
  data?: AssetContributionFormData;
};

export const TransactionSingleForm = ({
  onSubmit,
  onCancel,
  data,
}: TransactionSingleFormProps) => {
  /** Only for edit mode — avoids RHF `values` resetting the form every parent render (unstable `new Date()`). */
  const valuesFromProps = useMemo((): AssetContributionFormData | undefined => {
    if (!data) return undefined;
    return {
      value: typeof data.value === "string" ? data.value : String(data.value),
      valueDate: new Date(data.valueDate),
    };
  }, [data]);

  const form = useForm<AssetContributionFormData>({
    resolver: withTransform(
      zodResolver(assetContributionOrphanInsertSchema),
      (values) => ({
        ...values,
        value:
          values.value === undefined || values.value === null
            ? "0"
            : typeof values.value === "number"
              ? Decimal(values.value).toString()
              : String(values.value),
        valueDate: values.valueDate
          ? typeof values.valueDate === "string"
            ? new Date(values.valueDate)
            : values.valueDate
          : new Date(),
      })
    ),
    ...(valuesFromProps
      ? { values: valuesFromProps }
      : {
          defaultValues: {
            value: "0",
            valueDate: new Date(),
          },
        }),
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = form;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <FormField
            control={control}
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
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (£)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
            {data ? "Update Transaction" : "Add Transaction"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
