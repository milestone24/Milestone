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
import type {
  SecurityTransactionInsert,
  SecurityTransactionUpsert,
} from "@shared/schema";
import { securityTransactionInsertSchema } from "@shared/schema/transaction";
import { Controller, useForm } from "react-hook-form";
import { createDecimalValueString } from "@shared/schema";
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
  CancelButton?: React.ReactNode;
};

export const SecurityTransactionSingleForm = ({
  onSubmit,
  data,
  securities,
  CancelButton,
}: SecurityTransactionSingleFormProps) => {
  const form = useForm<SecurityTransactionUpsert>({
    resolver: zodResolver(
      securityTransactionInsertSchema.omit({
        fees: true,
        currency: true,
        recordedAt: true,
      })
    ),
    values: data
      ? {
          value: data.value,
          currencyValue: data.currencyValue,
          valueDate: data.valueDate,
          assetSecurityId: data.assetSecurityId,
          fees: data.fees,
          currency: data.currency,
          recordedAt: data.recordedAt,
        }
      : undefined,
    defaultValues: {
      value: createDecimalValueString("0"),
      currencyValue: createDecimalValueString("0"),
      valueDate: new Date(),
      assetSecurityId: "",
      fees: undefined,
      currency: undefined,
      recordedAt: undefined,
      //fees: createDecimalValueString("0"),
    },
    mode: "onTouched",
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting, isValid, errors },
    getValues,
  } = form;

  console.log("errors", errors);

  const validation = securityTransactionInsertSchema.safeParse(getValues());

  console.log("validation ; ", validation);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="assetSecurityId"
            rules={{
              required: true,
              // validate: (value) => {
              //   if (!value) {
              //     return "Security is required";
              //   } else if (!securities?.find((p) => p.id === value)) {
              //     return "Security is invalid";
              //   }
              //   return true;
              // },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Security</FormLabel>
                <FormDescription>
                  Select the security that you are adding a transaction for.
                </FormDescription>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
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
                      max={new Date().toISOString().split("T")[0]}
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
                    value={field.value ?? ""}
                    onChange={(e) => {
                      field.onChange(
                        e.target.value == ""
                          ? ""
                          : createDecimalValueString(e.target.value)
                      );
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="currencyValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency Payment</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Currency Payment"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      field.onChange(
                        e.target.value == ""
                          ? ""
                          : createDecimalValueString(e.target.value)
                      );
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2">
          {CancelButton}
          <Button type="submit" disabled={isSubmitting || !isValid}>
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
  );
};
