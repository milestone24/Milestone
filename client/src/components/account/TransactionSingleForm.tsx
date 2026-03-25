import { zodResolver } from "@hookform/resolvers/zod";
import {
  AssetContributionFormData,
  assetContributionOrphanInsertSchema,
} from "@shared/schema/transaction";
import { createDecimalValueString } from "@shared/schema";
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
  const form = useForm<AssetContributionFormData>({
    resolver: withTransform(
      zodResolver(assetContributionOrphanInsertSchema),
      (values) => ({
        ...values,
        value: values.value
          ? typeof values.value === "string"
            ? createDecimalValueString(values.value)
            : typeof values.value === "number"
            ? createDecimalValueString(Decimal(values.value).toString())
            : values.value
          : createDecimalValueString("0"),
        valueDate: values.valueDate
          ? typeof values.valueDate === "string"
            ? new Date(values.valueDate)
            : values.valueDate
          : new Date(),
      })
    ),
    values: data
      ? {
          value: data.value,
          valueDate: new Date(data.valueDate),
        }
      : {
          value: createDecimalValueString("0"),
          valueDate: new Date(),
        },
    defaultValues: {
      value: createDecimalValueString("0"),
      valueDate: new Date(),
    },
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = form;

  console.log("form", form.getValues());

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
                    {...field}
                    value={field.value ?? createDecimalValueString("0")}
                    onChange={(e) => {
                      field.onChange(createDecimalValueString(e.target.value));
                    }}
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
            {data ? "Update Contribution" : "Add Contribution"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
