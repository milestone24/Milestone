import { Text, View } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { withTransform } from "@milestone/js-common/react/form/withTransform";
import {
  employmentStatus,
  gender,
  maritalStatus,
  updateProfileOrphanSchema,
  type UpdateProfileOrphanInput,
  type UserProfile,
} from "@milestone/js-common/schema/user-account";
import { countriesOptions } from "@milestone/js-common/schema/countries";
import { createDecimalValueString } from "@milestone/js-common/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";

type UserProfileFormProps = {
  onSubmit: (data: UpdateProfileOrphanInput) => void | Promise<void>;
  data: UserProfile | undefined;
};

export function UserProfileForm({ onSubmit, data }: UserProfileFormProps) {
  const form = useForm<UpdateProfileOrphanInput>({
    resolver: withTransform(zodResolver(updateProfileOrphanSchema), (values) => ({
      ...values,
    })),
    values: data
      ? {
          ...data,
          netWorth: data.netWorth ? createDecimalValueString(data.netWorth) : null,
        }
      : undefined,
    defaultValues: {},
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = form;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Label>Date of Birth</Label>
        <Controller
          control={control}
          name="dob"
          render={({ field }) => (
            <DateInput value={field.value ?? undefined} onChange={field.onChange} />
          )}
        />
      </View>

      <View className="gap-2">
        <Label>Country of Origin</Label>
        <Controller
          control={control}
          name="countryOrigin"
          render={({ field }) => (
            <Select
              value={field.value ?? undefined}
              onValueChange={field.onChange}
              options={countriesOptions}
              placeholder="Select country"
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Label>Country of Residence</Label>
        <Controller
          control={control}
          name="countryResidence"
          render={({ field }) => (
            <Select
              value={field.value ?? undefined}
              onValueChange={field.onChange}
              options={countriesOptions}
              placeholder="Select country"
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Label>Gender</Label>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <Select
              value={field.value ?? undefined}
              onValueChange={field.onChange}
              options={gender.map((item) => ({ label: item, value: item }))}
              placeholder="Select gender"
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Label>Marital Status</Label>
        <Controller
          control={control}
          name="maritalStatus"
          render={({ field }) => (
            <Select
              value={field.value ?? undefined}
              onValueChange={field.onChange}
              options={maritalStatus.map((item) => ({ label: item, value: item }))}
              placeholder="Select marital status"
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Label>Employment Status</Label>
        <Controller
          control={control}
          name="employmentStatus"
          render={({ field }) => (
            <Select
              value={field.value ?? undefined}
              onValueChange={field.onChange}
              options={employmentStatus.map((item) => ({ label: item, value: item }))}
              placeholder="Select employment status"
            />
          )}
        />
      </View>

      {isDirty ? (
        <Button
          label={isSubmitting ? "Saving..." : "Save Profile"}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
      ) : null}
    </View>
  );
}
