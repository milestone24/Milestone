import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  accountType,
  createDecimalValueString,
  userAssetOrphanInsertSchema,
  type UserAssetOrphanInsert,
} from "@milestone/js-common/schema";
import { generateId } from "@milestone/js-common/utils/id";
import { useAssetCreate } from "@milestone/js-common/react/hooks/use-asset-create";
import { useBrokerPlatforms } from "@milestone/js-common/react/hooks/use-broker-platforms";
import { getAccountTypeFullName } from "@milestone/js-common/utils/platform";
import { AppModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";

type AddAccountModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const [stage, setStage] = useState(1);
  const createAsset = useAssetCreate();
  const { data: brokerPlatforms = [], isLoading: isLoadingPlatforms } = useBrokerPlatforms();

  const form = useForm<UserAssetOrphanInsert>({
    resolver: zodResolver(userAssetOrphanInsertSchema),
    defaultValues: {
      name: `account-${generateId()}`,
      valueMethod: "manual",
      securities: [],
      initialCashHolding: createDecimalValueString("0"),
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const selectedPlatformId = watch("platformId");
  const selectedPlatform = brokerPlatforms.find((platform) => platform.id === selectedPlatformId);

  const selectableAccountTypes = useMemo(() => {
    return (selectedPlatform ? selectedPlatform.supportedAccountTypes : accountType).filter(
      (type) => type !== "OTHER"
    );
  }, [selectedPlatform]);

  const platformOptions = brokerPlatforms.map((platform) => ({
    label: platform.name,
    value: platform.id,
  }));

  const accountTypeOptions = selectableAccountTypes.map((type) => ({
    label: getAccountTypeFullName(type),
    value: type,
  }));

  const closeModal = () => {
    onOpenChange(false);
    setStage(1);
    reset({
      name: `account-${generateId()}`,
      valueMethod: "manual",
      securities: [],
      initialCashHolding: createDecimalValueString("0"),
    });
  };

  const onSubmit = async (data: UserAssetOrphanInsert) => {
    await createAsset.mutateAsync(data);
    closeModal();
  };

  const handleNext = async () => {
    const valid = await trigger(["platformId", "accountType", "startDate"]);
    if (valid) setStage(2);
  };

  return (
    <AppModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeModal();
      }}
      title="Add Investment Account"
      description={stage === 1 ? "1) Account details" : "2) Opening value"}
      showCloseButton={false}
    >
      {stage === 1 ? (
        <View className="gap-4">
          <View className="gap-2">
            <Label>Platform</Label>
            <Controller
              control={control}
              name="platformId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={platformOptions}
                  placeholder="Select platform"
                  disabled={isLoadingPlatforms}
                />
              )}
            />
            {errors.platformId ? (
              <Text className="text-sm text-destructive">{errors.platformId.message}</Text>
            ) : null}
          </View>

          <View className="gap-2">
            <Label>Account type</Label>
            <Controller
              control={control}
              name="accountType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={accountTypeOptions}
                  placeholder="Select account type"
                  disabled={!selectedPlatformId}
                />
              )}
            />
            {errors.accountType ? (
              <Text className="text-sm text-destructive">{errors.accountType.message}</Text>
            ) : null}
          </View>

          <View className="gap-2">
            <Label>Start date</Label>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DateInput value={field.value} onChange={(date) => field.onChange(date ?? new Date())} />
              )}
            />
            {errors.startDate ? (
              <Text className="text-sm text-destructive">{errors.startDate.message}</Text>
            ) : null}
          </View>

          <View className="flex-row justify-end gap-2 pt-2">
            <Button variant="outline" label="Cancel" onPress={closeModal} />
            <Button label="Next" onPress={handleNext} />
          </View>
        </View>
      ) : (
        <View className="gap-4">
          <View className="gap-2">
            <Label>Current value (£)</Label>
            <Controller
              control={control}
              name="currentValue"
              render={({ field }) => (
                <Input
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  placeholder="Opening balance"
                />
              )}
            />
            {errors.currentValue ? (
              <Text className="text-sm text-destructive">{errors.currentValue.message}</Text>
            ) : null}
          </View>

          {errors.root ? (
            <Text className="text-sm text-destructive">{errors.root.message}</Text>
          ) : null}

          <View className="flex-row justify-end gap-2 pt-2">
            <Button variant="outline" label="Back" onPress={() => setStage(1)} />
            <Button
              label={isSubmitting ? "Adding..." : "Add Account"}
              disabled={isSubmitting}
              onPress={handleSubmit(onSubmit)}
            />
          </View>
        </View>
      )}
    </AppModal>
  );
}
