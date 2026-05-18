import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UserAssetSecuritySelect } from "@shared/schema/portfolio-assets";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { DateInput } from "../ui/date-input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Loader2 } from "lucide-react";
import type {
  SecurityTransactionInsert,
  SecurityTransactionUpsert,
  SecuritySearchResult,
} from "@shared/schema";
import { securityTransactionInsertSchema } from "@shared/schema/transaction";
import { useForm } from "react-hook-form";
import { createDecimalValueString } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import RSelect from "react-select";
import { cn } from "@/lib/utils";
import { useFindSecurities } from "@/hooks/use-find-securities";
import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

type AssetSecurityTransactionSingleFormProps = {
  onSubmit: (data: SecurityTransactionInsert) => Promise<void>;
  data?: SecurityTransactionInsert;
  securities: UserAssetSecuritySelect[];
  CancelButton?: React.ReactNode;
  allowNewSecurity?: boolean;
};

export const AssetSecurityTransactionSingleForm = ({
  onSubmit,
  data,
  securities,
  CancelButton,
  allowNewSecurity = true,
}: AssetSecurityTransactionSingleFormProps) => {
  const form = useForm<SecurityTransactionUpsert>({
    resolver: zodResolver(securityTransactionInsertSchema),
    defaultValues: {
      mode: data?.mode ?? "existing",
    },
  });

  const [searchInput, setSearchInput] = useState("");
  const [duplicateAssetSecurityId, setDuplicateAssetSecurityId] = useState<string | undefined>(undefined);

  const debouncedSearch = useDebouncedCallback(
    (input: string) => setSearchInput(input),
    100,
    3,
  );

  const {
    data: securitySearchResults,
    isLoading: isSearchLoading,
    isError: isSearchError,
  } = useFindSecurities(searchInput);

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: {
      isSubmitting,
      isValid,
      errors,
      isSubmitSuccessful,
      isSubmitted,
    },
  } = form;

  const setSelectedNewSecurity = (security: SecuritySearchResult | null) => {
    if (security === null) {
      setValue("security", undefined as never);
      setDuplicateAssetSecurityId(undefined);
      form.clearErrors("security");
      return;
    }

    const existing = securities.find(
      (s) => s.security.sourceIdentifier === security.sourceIdentifier
    );

    if (existing) {
      setDuplicateAssetSecurityId(existing.id);
      form.setError("security", {
        type: "manual",
        message: "This investment is already in this account.",
      });
      return;
    }

    setDuplicateAssetSecurityId(undefined);
    form.clearErrors("security");
    setValue("security", security);
  };

  const switchToExistingSecurity = () => {
    if (!duplicateAssetSecurityId) return;
    setValue("mode", "existing");
    setValue("assetSecurityId", duplicateAssetSecurityId);
    setDuplicateAssetSecurityId(undefined);
    form.clearErrors("security");
  };

  const mode = watch("mode");
  const security = watch("security");
  const assetSecurityId = watch("assetSecurityId");

  const hasSecuritySelected =
    mode === "existing"
      ? !!assetSecurityId
      : mode === "new"
        ? !!security
        : false;

  const canSubmit = !isSubmitting && isValid && hasSecuritySelected;

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit((data) => onSubmit(data))}
        className="flex flex-col gap-10"
      >
        <div className="flex flex-col gap-4">
          {!data && allowNewSecurity && (
            <FormField
              control={control}
              name="mode"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="sec-mode-existing" />
                    <Label
                      htmlFor="sec-mode-existing"
                      className="font-normal cursor-pointer"
                    >
                      Select existing
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="sec-mode-new" />
                    <Label
                      htmlFor="sec-mode-new"
                      className="font-normal cursor-pointer"
                    >
                      Add new security
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          )}
          {mode === "existing" ? (
            <FormField
              control={control}
              name="assetSecurityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Security</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Select the security that you are adding a transaction for.
                  </p>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                    }}
                    value={field.value}
                    disabled={!securities || securities.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {securities?.map((security) => (
                        <SelectItem key={security.id} value={security.id}>
                          {security.security.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={control}
              name="security"
              render={() => (
                <FormItem className="flex flex-col gap-1">
                  <FormLabel>Search Security</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Search for a security by name, ticker or ISIN.
                    <br />
                    You must enter at least three characters to search.
                  </p>
                  {isSearchError && (
                    <p className="text-sm font-medium text-destructive">
                      Unable to search for investments. Please try again.
                    </p>
                  )}
                  <FormControl>
                    <RSelect
                      unstyled
                      classNames={{
                        control: ({ isFocused }) =>
                          cn(
                            "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background",
                            isFocused && "ring-1 ring-ring ring-offset-2",
                          ),
                        placeholder: () => "text-muted-foreground",
                        input: () => "text-foreground",
                        singleValue: () => "text-foreground",
                        menu: () =>
                          "mt-1 rounded-md border border-border bg-popover shadow-md z-50",
                        menuList: () => "p-1",
                        option: ({ isFocused, isSelected }) =>
                          cn(
                            "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                            (isFocused || isSelected) &&
                              "bg-accent text-accent-foreground",
                          ),
                        noOptionsMessage: () =>
                          "py-2 text-sm text-center text-muted-foreground",
                        loadingMessage: () =>
                          "py-2 text-sm text-center text-muted-foreground",
                        indicatorSeparator: () => "bg-border mx-1",
                        dropdownIndicator: () => "text-muted-foreground px-1",
                        clearIndicator: () =>
                          "text-muted-foreground hover:text-foreground px-1 cursor-pointer",
                      }}
                      tabSelectsValue={false}
                      options={securitySearchResults ?? []}
                      getOptionLabel={(s) => `${s.symbol} - ${s.name}`}
                      onChange={(security) => {
                        setSelectedNewSecurity(security);
                      }}
                      onInputChange={(input) => debouncedSearch(input)}
                      inputValue={searchInput}
                      isClearable
                      isLoading={isSearchLoading}
                      placeholder="Search investments..."
                    />
                  </FormControl>
                  <FormMessage />
                  {duplicateAssetSecurityId && (
                    <button
                      type="button"
                      className="text-sm text-primary underline-offset-4 hover:underline self-start"
                      onClick={switchToExistingSecurity}
                    >
                      Add a transaction for the existing holding instead
                    </button>
                  )}
                </FormItem>
              )}
            />
          )}

          <FormField
            control={control}
            name="valueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <DateInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  disabled={field.disabled}
                  max={new Date()}
                />
                <FormMessage />
              </FormItem>
            )}
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
                        e.target.value === ""
                          ? ""
                          : createDecimalValueString(e.target.value),
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
                        e.target.value === ""
                          ? ""
                          : createDecimalValueString(e.target.value),
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
            name="fundedFromCash"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Use cash balance</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          {CancelButton}
          <Button type="submit" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {data
              ? isSubmitting
                ? "Updating Transaction..."
                : "Update Transaction"
              : isSubmitting
                ? "Adding Transaction..."
                : "Add Transaction"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
