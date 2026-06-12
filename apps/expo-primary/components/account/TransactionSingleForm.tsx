import { View, Text } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import Decimal from "decimal.js";
import { Controller, useForm } from "react-hook-form";
import { withTransform } from "@milestone/js-common/react/form/withTransform";
import {
  assetContributionOrphanInsertSchema,
  type AssetContributionFormData,
} from "@milestone/js-common/schema/transaction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

type TransactionSingleFormProps = {
  onSubmit: (data: AssetContributionFormData) => Promise<void>;
  onCancel?: () => void;
  data?: AssetContributionFormData;
};

export function TransactionSingleForm({
  onSubmit,
  onCancel,
  data,
}: TransactionSingleFormProps) {
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
    defaultValues: data
      ? {
          value: typeof data.value === "string" ? data.value : String(data.value),
          valueDate: new Date(data.valueDate),
        }
      : {
          value: "0",
          valueDate: new Date(),
        },
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = form;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Label>Date</Label>
        <Controller
          control={control}
          name="valueDate"
          render={({ field }) => (
            <DateInput value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.valueDate ? (
          <Text className="text-sm text-destructive">{errors.valueDate.message}</Text>
        ) : null}
      </View>

      <View className="gap-2">
        <Label>Amount (£)</Label>
        <Controller
          control={control}
          name="value"
          render={({ field }) => (
            <Input
              value={field.value ?? ""}
              onChangeText={field.onChange}
              keyboardType="decimal-pad"
              placeholder="Amount"
            />
          )}
        />
        {errors.value ? (
          <Text className="text-sm text-destructive">{errors.value.message}</Text>
        ) : null}
      </View>

      <View className="flex-row justify-end gap-2 pt-2">
        {onCancel ? (
          <Button variant="outline" label="Cancel" disabled={isSubmitting} onPress={onCancel} />
        ) : null}
        <Button
          label={isSubmitting ? "Saving..." : data ? "Update Transaction" : "Add Transaction"}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </View>
  );
}
