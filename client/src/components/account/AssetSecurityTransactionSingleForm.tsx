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
import { DecimalInput } from "../ui/decimal-input";
import { DateInput } from "../ui/date-input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { ChevronDown, Loader2 } from "lucide-react";
import type {
  SecurityTransactionSelect,
  SecurityTransactionInsert,
  SecurityTransactionUpsert,
  SecuritySearchResult,
} from "@shared/schema";
import {
  securityTransactionInsertSchema,
  securityTransactionMutateSchema,
} from "@shared/schema/transaction";
import { useForm } from "react-hook-form";
import { createDecimalValueString, isDecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";
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
import { formatCurrencyDecimal } from "@/utils/decimal";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useDerivedSharePaymentTotal } from "@/hooks/useDerivedSharePaymentTotal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

type AssetSecurityTransactionSingleFormProps = {
  onSubmit: (data: SecurityTransactionUpsert) => Promise<void>;
  data?: SecurityTransactionSelect;
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
    resolver: zodResolver(
      data ? securityTransactionMutateSchema : securityTransactionInsertSchema,
    ),
    defaultValues: data
      ? {
          mode: "existing",
          value: data?.value,
          perUnitValue: data?.perUnitValue,
          currencyValue: data?.currencyValue,
          valueDate: data?.valueDate,
          assetSecurityId: data?.assetSecurityId,
          fees: data?.fees ?? undefined,
          taxes: data?.taxes ?? undefined,
          ledgerGroupId: data?.ledgerGroupId ?? undefined,
          //If data is set we only set this to satisfy the form data resolver.
          //It will be ignored by the onSubmit handler and beackend as ledgerGroupId is set.
          fundedFromCash: data?.ledgerGroupId ? true : false,
        }
      : {
          mode: "existing",
          fundedFromCash: true,
        },
    mode: "all",
  });

  const [feesTaxesOpen, setFeesTaxesOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [duplicateAssetSecurityId, setDuplicateAssetSecurityId] = useState<
    string | undefined
  >(undefined);

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
    formState: { isSubmitting, isValid },
  } = form;

  const setSelectedNewSecurity = (security: SecuritySearchResult | null) => {
    if (security === null) {
      setValue("security", undefined as never);
      setDuplicateAssetSecurityId(undefined);
      form.clearErrors("security");
      return;
    }

    const existing = securities.find(
      (s) => s.security.sourceIdentifier === security.sourceIdentifier,
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
  const watchedShares = watch("value");
  const watchedPerUnitValue = watch("perUnitValue");
  const watchedCurrencyValue = watch("currencyValue");

  useDerivedSharePaymentTotal(watchedShares, watchedPerUnitValue, (value) =>
    setValue("currencyValue", value),
  );

  const hasSecuritySelected =
    mode === "existing"
      ? !!assetSecurityId
      : mode === "new"
        ? !!security
        : false;

  const derivedCurrencyValue =
    watchedShares && watchedPerUnitValue
      ? createDecimalValueString(
          new Decimal(watchedShares)
            .abs()
            .mul(watchedPerUnitValue)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toString(),
        )
      : null;

  /*
   * This is purely for display purposes when data has been given to this component (edit mode)
   * And should not be confused with any select behaviour
   */
  const dataSecurity = data
    ? securities.find((s) => s.id === data.assetSecurityId)
    : undefined;

  const canSubmit = !isSubmitting && isValid && hasSecuritySelected;

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit((data) => onSubmit(data))}
        className="flex flex-col gap-10"
      >
        <div className="flex flex-col gap-4">
          {!data ? (
            <>
              {allowNewSecurity ? (
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
                        <RadioGroupItem
                          value="existing"
                          id="sec-mode-existing"
                        />
                        <Label
                          htmlFor="sec-mode-existing"
                          className="font-normal cursor-pointer"
                        >
                          Use existing security
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
              ) : null}
              {mode === "existing" ? (
                <FormField
                  control={control}
                  name="assetSecurityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Security</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Select the security that you are adding a transaction
                        for.
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
                            dropdownIndicator: () =>
                              "text-muted-foreground px-1",
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
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {dataSecurity?.security.name}
              </p>
            </>
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
                  <DecimalInput
                    ref={field.ref}
                    value={field.value ?? undefined}
                    decimalScale={8}
                    placeholder="Number of Shares"
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    onChange={(shares) => {
                      field.onChange(shares);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="perUnitValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price Per Share</FormLabel>
                <FormControl>
                  <DecimalInput
                    ref={field.ref}
                    value={field.value ?? undefined}
                    decimalScale={4}
                    placeholder="Price Per Share"
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    onChange={(perUnitValue) => {
                      field.onChange(perUnitValue);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="text-sm text-muted-foreground">
            Total payment:{" "}
            {watchedCurrencyValue
              ? formatCurrencyDecimal(watchedCurrencyValue)
              : "--"}
          </p>

          {!!data ? (
            <>
              {data.ledgerGroupId ? (
                <p className="text-sm text-muted-foreground">
                  This transaction is linked to a cash movement and that setting
                  can not be changed.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This transaction is not linked to a cash movement and that
                  setting can not be changed.
                </p>
              )}
            </>
          ) : (
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
          )}
        </div>

        <Collapsible open={feesTaxesOpen} onOpenChange={setFeesTaxesOpen}>
          <CollapsibleTrigger
            type="button"
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            Fees & Taxes
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                feesTaxesOpen && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-4 data-[state=closed]:hidden">
            <FormField
              control={control}
              name="fees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fees</FormLabel>
                  <FormControl>
                    <DecimalInput
                      ref={field.ref}
                      value={field.value ?? undefined}
                      decimalScale={2}
                      placeholder="Fees"
                      onBlur={field.onBlur}
                      disabled={field.disabled}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="taxes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxes</FormLabel>
                  <FormControl>
                    <DecimalInput
                      ref={field.ref}
                      value={field.value ?? undefined}
                      decimalScale={2}
                      placeholder="Taxes"
                      onBlur={field.onBlur}
                      disabled={field.disabled}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

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
