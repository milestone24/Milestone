import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  recurringContributionOrphanSchema,
  RecurringContributionFormData,
} from "@shared/schema/contribution";
import {
  Form,
  FormField,
  FormLabel,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { RecurringContribution } from "@shared/schema/portfolio-assets";
import { dateToDateInputValue } from "@/lib/form";
import { Loader2 } from "lucide-react";

type ContributionRecurringFormProps = {
  onSubmit: (data: RecurringContributionFormData) => void;
  data?: RecurringContribution;
};

const defaultValues: RecurringContributionFormData = {
  amount: 0,
  startDate: new Date(),
  pattern: {
    type: "rrule",
    expression: "FREQ=MONTHLY;BYDAY=2TU",
  },
  isActive: true,
};

export const ContributionRecurringForm = ({
  onSubmit,
  data,
}: ContributionRecurringFormProps) => {
  const form = useForm<RecurringContributionFormData>({
    resolver: zodResolver(recurringContributionOrphanSchema),
    values: data ?? defaultValues,
    defaultValues: defaultValues,
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = form;

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
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-10"
        >
          <div className="flex flex-row flex-wrap gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <Controller
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <Input
                        type="date"
                        {...field}
                        value={dateToDateInputValue(field.value)}
                        onChange={(e) => {
                          field.onChange(new Date(e.target.value));
                        }}
                      />
                    )}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (£)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      value={field.value.toString()}
                      onChange={(e) => {
                        field.onChange(Number(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {/* <div className="flex flex-row flex-wrap">
            <FormField
              control={control}
              name="interval"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Frequency</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="weekly" aria-label="Weekly">
                        Weekly
                      </ToggleGroupItem>
                      <ToggleGroupItem value="biweekly" aria-label="Biweekly">
                        Biweekly
                      </ToggleGroupItem>
                      <ToggleGroupItem value="monthly" aria-label="Monthly">
                        Monthly
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div> */}
          <div className="flex flex-row flex-wrap">
            <FormField
              control={control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable this recurring contribution
                    </p>
                  </div>
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
    </>
  );
};
