import { withTransform } from "@/lib/utils/mappers";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UpdateProfileOrphanInput,
  updateProfileOrphanSchema,
  UserProfile,
} from "@shared/schema/user-account";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import { dateToDateInputValue } from "@/lib/form";
import {
  maritalStatus,
  gender,
  employmentStatus,
} from "@shared/schema/user-account";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { countriesOptions } from "@shared/schema/countries";
import { createDecimalValueString } from "@shared/schema";

export type UserProfileFormProps = {
  onSubmit: (data: UpdateProfileOrphanInput) => void;
  data: UserProfile | undefined;
};

export const UserProfileForm = ({ onSubmit, data }: UserProfileFormProps) => {
  console.log("UserProfileForm data", data);

  const form = useForm<UpdateProfileOrphanInput>({
    resolver: withTransform(
      zodResolver(updateProfileOrphanSchema),
      (values) => ({
        ...values,
      })
    ),
    values: data
      ? {
          ...data,
          netWorth: data.netWorth
            ? createDecimalValueString(data.netWorth)
            : null,
        }
      : undefined,
    defaultValues: {},
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors, isDirty },
  } = form;

  return (
    <div>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={control}
            name="dob"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={dateToDateInputValue(field.value)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="countryOrigin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country of Origin</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value === null ? undefined : field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {countriesOptions?.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="countryResidence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country of Residence</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value === null ? undefined : field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* Only show countries that are in the countriesOptions */}
                    {countriesOptions?.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value === null ? undefined : field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {gender?.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {gender}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="maritalStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marital Status</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value === null ? undefined : field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {maritalStatus?.map((maritalStatus) => (
                        <SelectItem key={maritalStatus} value={maritalStatus}>
                          {maritalStatus}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="employmentStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employment Status</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value === null ? undefined : field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employmentStatus?.map((employmentStatus) => (
                        <SelectItem
                          key={employmentStatus}
                          value={employmentStatus}
                        >
                          {employmentStatus}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />

          {isDirty ? (
            <Button type="submit">
              {isSubmitting ? "Saving..." : "Save Profile"}
            </Button>
          ) : null}
        </form>
      </Form>
    </div>
  );
};
