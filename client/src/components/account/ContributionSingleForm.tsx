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
import { dateToDateInputValue } from "@/lib/form";
import { Loader2 } from "lucide-react";

type ContributionSingleFormProps = {
  onSubmit: (data: SingleContributionFormData) => Promise<void>;
  data?: SingleContributionFormData;
};

export const ContributionSingleForm = ({
  onSubmit,
  data,
}: ContributionSingleFormProps) => {
  const form = useForm<SingleContributionFormData>({
    resolver: zodResolver(singleContributionOrphanSchema),
    values: data
      ? {
          value: data.value,
          recordedAt: new Date(data.recordedAt),
        }
      : {
          value: 0,
          recordedAt: new Date(),
        },
    defaultValues: {
      value: 0,
      recordedAt: new Date(),
    },
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
            name="recordedAt"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={dateToDateInputValue(field.value)}
                      onChange={(e) => {
                        field.onChange(new Date(e.target.value));
                      }}
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
                  <Input
                    {...field}
                    type="number"
                    value={field.value.toString()}
                    onChange={(e) => {
                      field.onChange(+e.target.value);
                    }}
                  />
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
