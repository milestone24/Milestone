import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { useFindSecurities } from "@/hooks/use-find-securities";
import { SecuritySearchResult, createDecimalValueString } from "@shared/schema";
import { UserAssetSecurityInsert } from "@shared/schema/portfolio-assets";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "../ui/form";
import RSelect from "react-select";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

/*
 * See https://react-select.com/components
 */
// const SecurityOptions = ({
//   innerProps,
//   isFocused,
//   isSelected,
//   data,
// }: {
//   innerProps: any;
//   isFocused: boolean;
//   isSelected: boolean;
//   data: any;
// }) => {
//   return <div {...innerProps}>{data.label}</div>;
// };

export const AssetSecurityForm = ({
  onSubmit,
  onCancel,
  startDate,
}: {
  onSubmit: (value: UserAssetSecurityInsert) => void;
  onCancel: () => void;
  startDate?: Date | null;
}) => {
  const form = useForm<UserAssetSecurityInsert>({
    //We need this as the form library does not use react-hook form effectively to allow valueAsNumber to work
    //And we really need a float anyway

    defaultValues: {
      security: undefined,
      shareHolding: createDecimalValueString("0"),
      currencyValue: createDecimalValueString("0"),
      startDate: startDate ?? new Date(),
    },
  });

  const {
    control,
    watch,
    formState: { errors },
  } = form;

  const [searchInput, setSearchInput] = useState("");
  const [selectedSecurity, setSelectedSecurity] =
    useState<SecuritySearchResult | null>(null);

  const debouncedSearch = useDebouncedCallback(
    (input: string) => {
      setSearchInput(input);
    },
    100,
    3
  );

  const { data: securities, isLoading: isLoadingSecurities } =
    useFindSecurities(searchInput);

  return (
    <>
      <Form {...form}>
        <FormDescription>Seacrh by Name / Ticker / ISIN</FormDescription>
        <RSelect
          options={securities ?? []}
          getOptionLabel={(security) => `${security.symbol} - ${security.name}`}
          value={selectedSecurity}
          onChange={(security) => {
            setSelectedSecurity(security);
          }}
          onInputChange={(input) => {
            debouncedSearch(input);
          }}
          inputValue={searchInput}
          isLoading={isLoadingSecurities}
          placeholder="Search securities..."
          // components={{
          //   Option: SecurityOptions,
          // }}
        />
        <FormField
          control={control}
          name="shareHolding"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Share Holdings</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Share Holdings"
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
        <FormField
          control={control}
          name="currencyValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency Value</FormLabel>
              <FormDescription>
                The currency paid for the security to date.
              </FormDescription>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Currency Value"
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
        <FormField
          control={control}
          name="priorGainLoss"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prior Gain/Loss</FormLabel>
              <FormDescription>
                The prior gain/loss for the security.
              </FormDescription>
              <FormControl>
                <Input type="number" placeholder="Prior Gain/Loss" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {startDate ? (
          <span>Start Date: {startDate.toLocaleDateString()}</span>
        ) : (
          <FormField
            control={form.control}
            name="startDate"
            render={() => (
              <FormItem>
                <FormLabel>Select Start Date</FormLabel>
                <FormDescription>
                  When did you start this security?{" "}
                </FormDescription>
                <Controller
                  control={form.control}
                  name="startDate"
                  rules={{ required: true }}
                  render={({ field }) => {
                    return (
                      <Input
                        type="date"
                        onChange={(e) =>
                          field.onChange(new Date(e.target.value))
                        }
                        value={
                          field.value
                            ? field.value.toISOString().split("T")[0]
                            : ""
                        }
                      />
                    );
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex flex-row gap-2">
          <Button variant="outline" onClick={() => onCancel()}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedSecurity) {
                onSubmit({
                  tempId: crypto.randomUUID(),
                  security: selectedSecurity,
                  shareHolding: form.getValues("shareHolding") || 0,
                  currencyValue: form.getValues("currencyValue") || 0,
                  priorGainLoss: form.getValues("priorGainLoss") || 0,
                  startDate: form.getValues("startDate"),
                } as UserAssetSecurityInsert);
                setSelectedSecurity(null);
                setSearchInput("");
                form.reset();
              }
            }}
            disabled={!selectedSecurity}
          >
            Add
          </Button>
        </div>
      </Form>
    </>
  );
};
