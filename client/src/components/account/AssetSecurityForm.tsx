import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { useFindSecurities } from "@/hooks/use-find-securities";
import { formatCurrencyDecimal } from "@/utils/decimal";
import { SecurityInsert } from "@shared/schema";
import {
  ResolvedAssetSecurity,
  UserAssetSecurityBase,
  UserAssetSecurityOrphanLinkInsert,
  userAssetSecurityOrphanLinkInsertSchema,
  UserAssetSecurityOrphanNewCreateInsert,
  userAssetSecurityOrphanNewCreateInsertSchema,
} from "@shared/schema/portfolio-assets";
import { useCallback, useState } from "react";
import { useForm, useFormContext } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import { DecimalInput } from "../ui/decimal-input";
import { useDerivedSharePaymentTotal } from "@/hooks/useDerivedSharePaymentTotal";
import { DateInput } from "../ui/date-input";
import { Button } from "../ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Checkbox } from "../ui/checkbox";

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

export type AssetSecurityNewFormData = UserAssetSecurityOrphanNewCreateInsert;

type AssetSecurityNewFormProps = {
  onSubmit: (value: AssetSecurityNewFormData) => Promise<void>;
  onCancel: () => void;
  startDate: Date | undefined;
  startDateMin: Date | undefined;
  startDateIsEditable: boolean;
};

// type AssetSecurityNewFormData = Omit<UserAssetSecurityWithInitialValuesInsert, "security"> & {
//   security: SecurityInsert | null;
// };

export const AssetSecurityNewForm = ({
  onSubmit,
  onCancel,
  startDate,
  startDateMin,
  startDateIsEditable,
}: AssetSecurityNewFormProps) => {
  const form = useForm<AssetSecurityNewFormData>({
    resolver: zodResolver(userAssetSecurityOrphanNewCreateInsertSchema),
    defaultValues: {
      type: "new",
      startDate: startDate ?? new Date(),
      initialHolding: undefined,
      fundedFromCash: true,
    },
    mode: "all",
  });

  const {
    getValues,
    formState: { isValid, isSubmitting, errors },
  } = form;

  const [error, setError] = useState<string | undefined>(undefined);

  const baseFieldProps: AssetSecurityBaseFieldsProps =
    startDate && startDateIsEditable
      ? { startDateIsEditable: true, startDateMin: startDateMin }
      : { startDateIsEditable: false, startDateMin: undefined };

  const submit = useCallback(
    async (formData: AssetSecurityNewFormData) => {
      return onSubmit(formData).catch((error) => {
        console.error("AssetSecurityNewForm submit error", error);
        setError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
      });
    },
    [onSubmit]
  );

  return (
    <Form {...form}>
      {error && <p className="text-red-500">{error}</p>}
      <form
        onSubmit={form.handleSubmit(submit)}
        className="flex flex-col gap-4"
      >
        <AssetSecurityNewFormFields
          startDate={startDate}
          startDateMin={startDateMin}
          startDateIsEditable={startDateIsEditable}
        />
        <div className="flex flex-row justify-end gap-2 mt-8">
          <Button
            variant="outline"
            onClick={() => onCancel()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting ? "Adding..." : "Add"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export type AssetSecurityNewFormFieldsProps = {
  startDate: Date | undefined;
  startDateMin: Date | undefined;
  startDateIsEditable: boolean;
};

export const AssetSecurityNewFormFields = ({
  startDate,
  startDateMin,
  startDateIsEditable,
}: AssetSecurityNewFormFieldsProps) => {
  const baseFieldProps: AssetSecurityBaseFieldsProps =
    startDate && startDateIsEditable
      ? { startDateIsEditable: true, startDateMin: startDateMin }
      : { startDateIsEditable: false, startDateMin: undefined };

  return (
    <>
      <AssetSecurityNewFields />
      <AssetSecurityBaseFields {...baseFieldProps} />
    </>
  );
};

type AssetSecurityEditFormData = UserAssetSecurityOrphanLinkInsert;

type AssetSecurityEditFormProps = {
  onSubmit: (value: AssetSecurityEditFormData) => Promise<void>;
  onCancel: () => void;
  startDateMin: Date | undefined;
  startDateIsEditable: boolean;
  data: ResolvedAssetSecurity;
};

export const AssetSecurityEditForm = ({
  onSubmit,
  onCancel,
  startDateMin,
  startDateIsEditable,
  data,
}: AssetSecurityEditFormProps) => {
  const form = useForm<AssetSecurityEditFormData>({
    resolver: zodResolver(userAssetSecurityOrphanLinkInsertSchema),
    values: {
      type: "link",
      securityId: data.security.id,
      startDate: data.startDate,
    },
    defaultValues: {
      type: "link",
      securityId: data.security.id,
      startDate: data.startDate,
    },
    mode: "all",
  });

  const [error, setError] = useState<string | undefined>(undefined);

  const {
    formState: { isValid, isSubmitting },
    handleSubmit,
  } = form;

  const submit = useCallback(
    async (formData: UserAssetSecurityOrphanLinkInsert) => {
      return onSubmit({
        ...formData,
      }).catch((error) => {
        setError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
      });
    },
    [onSubmit, data]
  );

  const baseFieldProps: AssetSecurityBaseFieldsProps = startDateIsEditable
    ? { startDateIsEditable: true, startDateMin }
    : { startDateIsEditable: false, startDateMin: undefined };

  return (
    <>
      <div>
        <h2>Security Details</h2>
        <p>Name: {data.security.name}</p>
        <p>Symbol: {data.security.symbol}</p>
        <p>ISIN: {data.security.isin}</p>
      </div>
      <Form {...form}>
        {error && <p className="text-red-500">{error}</p>}
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <AssetSecurityBaseFields {...baseFieldProps} />
          <p>
            <em className="text-sm text-muted-foreground">
              *Note: When editing a security, you can only change the start date.
              <br />
              If you need to change the initial values you will need to change
              the transaction history.
            </em>
          </p>
          <div className="flex flex-row justify-end gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => onCancel()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}></Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {isSubmitting ? "Applying..." : "Apply"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};

type AssetSecurityNewFields = Pick<
  UserAssetSecurityOrphanNewCreateInsert,
  "initialHolding" | "fundedFromCash"
> & {
  security: SecurityInsert | undefined;
};

const AssetSecurityNewFields = () => {
  const { control, watch, setValue } = useFormContext<AssetSecurityNewFields>();

  const [addInitialTransaction, setAddInitialTransaction] = useState(false);

  const watchedShares = watch("initialHolding.shareHolding");
  const watchedPerUnitValue = watch("initialHolding.perUnitValue");
  const watchedCurrencyValue = watch("initialHolding.currencyValue");

  useDerivedSharePaymentTotal(watchedShares, watchedPerUnitValue, (value) =>
    setValue("initialHolding.currencyValue", value),
  );

  const [searchInput, setSearchInput] = useState("");

  const debouncedSearch = useDebouncedCallback(
    (input: string) => {
      setSearchInput(input);
    },
    100,
    3
  );

  const { data: securities, isLoading: isLoadingSecurities, isError: isSecuritiesError } =
    useFindSecurities(searchInput);

  const hasSearchError = isSecuritiesError;

  return (
    <>
      <FormField
        control={control}
        name="security"
        rules={{ required: true }}
        render={({ field }) => {
          const { onChange, ...fieldProps } = field;
          return (
            <FormItem>
              <FormLabel>Security</FormLabel>
              <FormDescription>
                Search for a security by name, ticker or ISIN.
                <br />
                You must enter at least three characters to search.
              </FormDescription>
              {hasSearchError && (
                <p className="text-sm font-medium text-destructive">
                  Unable to search for investments. Please try again.
                </p>
              )}
              <FormControl>
                <RSelect
                  {...fieldProps}
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
                  tabIndex={0}
                  tabSelectsValue={false}
                  options={securities ?? []}
                  getOptionLabel={(security) =>
                    `${security.symbol} - ${security.name}`
                  }
                  onChange={(security) => {
                    field.onChange(security == null ? {} : security);
                  }}
                  onInputChange={(input) => {
                    debouncedSearch(input);
                  }}
                  isClearable={true}
                  inputValue={searchInput}
                  isLoading={isLoadingSecurities}
                  placeholder="Search investments..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <div className="flex flex-row gap-2">
        <Checkbox
          checked={addInitialTransaction}
          onCheckedChange={(checked) =>
            setAddInitialTransaction(checked === true)
          }
        />
        <FormLabel>Add Initial Transaction</FormLabel>
      </div>
      {addInitialTransaction ? (
        <>
          <FormField
            control={control}
            name="initialHolding.shareHolding"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shares Held</FormLabel>
                <FormControl>
                  <DecimalInput
                    ref={field.ref}
                    value={field.value ?? undefined}
                    decimalScale={8}
                    placeholder="Shares Held"
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
            name="initialHolding.perUnitValue"
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
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {watchedCurrencyValue && (
            <p className="text-sm text-muted-foreground">
              Total: {formatCurrencyDecimal(watchedCurrencyValue)}
            </p>
          )}
          <FormField
            control={control}
            name="fundedFromCash"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Use cash balance
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
        </>
      ) : null}
    </>
  );
};

type AssetSecurityBaseFieldsProps =
  | {
      startDateIsEditable: true;
      startDateMin: Date | undefined;
    }
  | {
      startDateIsEditable: false;
      startDateMin: undefined;
    };

const AssetSecurityBaseFields = ({
  startDateIsEditable,
  startDateMin,
}: AssetSecurityBaseFieldsProps) => {
  const { control, watch } = useFormContext<UserAssetSecurityBase>();
  const startDate = watch("startDate");
  return (
    <>
      {startDate && !startDateIsEditable ? (
        <span>Start Date: {startDate.toLocaleDateString()}</span>
      ) : (
        <FormField
          control={control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Start Date</FormLabel>
              <FormDescription>
                When did you start this security?{" "}
              </FormDescription>
              <DateInput
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                disabled={field.disabled}
                min={startDateMin}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {/* TODO: re-enable prior gain/loss
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
              <Input
                type="number"
                placeholder="Prior Gain/Loss"
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
      */}
    </>
  );
}; 
