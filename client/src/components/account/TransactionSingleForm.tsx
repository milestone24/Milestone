import { zodResolver } from "@hookform/resolvers/zod";
import {
  SingleContributionFormData,
  singleContributionOrphanSchema,
} from "@shared/schema/contribution";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { withTransform } from "@/lib/utils/mappers";

type TransactionSingleFormProps = {
  onSubmit: (data: SingleContributionFormData) => Promise<void>;
  data?: SingleContributionFormData;
};

export const TransactionSingleForm = ({
  onSubmit,
  data,
}: TransactionSingleFormProps) => {
  const form = useForm<SingleContributionFormData>({
    resolver: withTransform(
      zodResolver(singleContributionOrphanSchema),
      (values) => ({
        ...values,
        value: values.value
          ? typeof values.value === "string"
            ? parseFloat(values.value)
            : values.value
          : 0,
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
          value: 0,
          valueDate: new Date(),
        },
    defaultValues: {
      value: 0,
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
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      value={
                        field.value
                          ? field.value.toISOString().split("T")[0]
                          : ""
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (£)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 ml-2" />
            ) : data ? (
              "Update Contribution"
            ) : (
              "Add Contribution"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
