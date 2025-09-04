import { zodResolver } from "@hookform/resolvers/zod";
import { UserAssetSecuritySelect } from "@shared/schema/portfolio-assets";
import {
  Form,
  FormControl,
  FormField,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { dateToDateInputValue } from "@/lib/form";
import { Loader2 } from "lucide-react";
import {
  SecurityTransactionInsert,
  securityTransactionInsertSchema,
  securityTransactionOrphanInsertSchema,
  SecurityTransactionUpsert,
} from "@shared/schema/securities";
import { Controller, useForm } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type SecurityTransactionSingleFormProps = {
  onSubmit: (data: SecurityTransactionInsert) => Promise<void>;
  data?: SecurityTransactionInsert;
  securities: UserAssetSecuritySelect[];
};

export const SecurityTransactionSingleForm = ({
  onSubmit,
  data,
  securities,
}: SecurityTransactionSingleFormProps) => {
  const form = useForm<SecurityTransactionUpsert>({
    resolver: zodResolver(securityTransactionInsertSchema),
    // values: data
    //   ? {
    //       securityId: data.securityId,
    //       value: data.value,
    //       valueDate: data.valueDate,
    //       recordedAt: new Date(data.recordedAt),
    //     }
    //   : {
    //       securityId: "",
    //       value: 0,
    //       valueDate: new Date(),
    //       recordedAt: new Date(),
    //     },
    defaultValues: {
      value: 0,
      valueDate: new Date(),
      securityId: undefined,
    },
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting, errors, isValid },
    getValues,
    watch,
  } = form;

  console.log("errors", errors);

  const values = getValues();

  console.log("values", values);

  const securityId = watch("securityId");

  console.log("securityId", securityId);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="securityId"
            rules={{
              required: true,
              validate: (value) => {
                if (!value) {
                  return "Security is required";
                } else if (!securities?.find((p) => p.id === value)) {
                  return "Security is invalid";
                }
                return true;
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Security</FormLabel>
                <FormDescription>
                  Select the security that you are adding a transaction for.
                </FormDescription>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={!securities}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {securities?.map((security) => (
                      <SelectItem key={security.id} value={security.id}>
                        {security.security.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
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
                <FormLabel>Number of Shares</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Number of Shares"
                    {...field}
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
