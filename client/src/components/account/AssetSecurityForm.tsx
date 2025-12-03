import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { useFindSecurities } from "@/hooks/use-find-securities";
import {
  DecimalValueString,
  SecurityInsert,
  SecuritySearchResult,
  createDecimalValueString,
} from "@shared/schema";
import {
  ResolvedAssetSecurity,
  UserAssetSecurityBase,
  UserAssetSecurityInsert,
  UserAssetSecurityInsertLink,
  UserAssetSecurityInsertNew,
  userAssetSecurityInsertSchema,
  UserAssetSecuritySelect,
  UserAssetSecurityWithInitialValuesInsert,
  userAssetSecurityWithInitialValuesInsertSchema,
} from "@shared/schema/portfolio-assets";
import { useState } from "react";
import { Controller, useForm, useFormContext } from "react-hook-form";
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
import { zodResolver } from "@hookform/resolvers/zod";

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

type AssetSecurityNewFormProps = {
  onSubmit: (value: UserAssetSecurityWithInitialValuesInsert) => void;
  onCancel: () => void;
  startDate: Date | undefined;
  startDateMin: Date | undefined;
  startDateIsEditable: boolean;
};

export const AssetSecurityNewForm = ({
  onSubmit,
  onCancel,
  startDate,
  startDateMin,
  startDateIsEditable,
}: AssetSecurityNewFormProps) => {
  const form = useForm<UserAssetSecurityWithInitialValuesInsert>({
    resolver: zodResolver(userAssetSecurityWithInitialValuesInsertSchema),
    defaultValues: {
      security: undefined,
      shareHolding: createDecimalValueString("0"),
      currencyValue: createDecimalValueString("0"),
      priorGainLoss: "",
      startDate: startDate ?? new Date(),
    },
    mode: "onBlur",
  });

  const {
    control,
    watch,
    formState: { errors, isValid },
    getValues,
  } = form;

  const baseFieldProps: AssetSecurityBaseFieldsProps =
    startDate && startDateIsEditable
      ? { startDateIsEditable: true, startDateMin: startDateMin }
      : { startDateIsEditable: false, startDateMin: undefined };

  return (
    <Form {...form}>
      <AssetSecurityNewFields />
      <AssetSecurityBaseFields {...baseFieldProps} />
      <div className="flex flex-row gap-2">
        <Button variant="outline" onClick={() => onCancel()}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (isValid) {
              onSubmit(getValues());
            }
          }}
          disabled={!isValid}
        >
          Add
        </Button>
      </div>
    </Form>
  );
};
type FormData = UserAssetSecurityInsertLink;

type AssetSecurityEditFormProps = {
  onSubmit: (value: FormData) => void;
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
  const form = useForm<FormData>({
    resolver: zodResolver(userAssetSecurityWithInitialValuesInsertSchema),
    values: {
      securityId: data.security.id,
      priorGainLoss: data.priorGainLoss ?? undefined,
      startDate: data.startDate,
      userAssetId: data.userAssetId,
    },
    defaultValues: {
      securityId: data.security.id,
      priorGainLoss: data.priorGainLoss ?? undefined,
      startDate: data.startDate,
      userAssetId: data.userAssetId,
    },
    mode: "onBlur",
  });

  const {
    control,
    watch,
    formState: { errors, isValid },
    getValues,
  } = form;

  const baseFieldProps: AssetSecurityBaseFieldsProps = startDateIsEditable
    ? { startDateIsEditable: true, startDateMin }
    : { startDateIsEditable: false, startDateMin: undefined };

  return (
    <Form {...form}>
      <AssetSecurityBaseFields {...baseFieldProps} />
      <p>
        When editing a security, you can only change the start date and prior
        gain/loss.
      </p>
      <div className="flex flex-row gap-2">
        <Button variant="outline" onClick={() => onCancel()}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (isValid) {
              onSubmit(getValues());
            }
          }}
          disabled={!isValid}
        >
          Add
        </Button>
      </div>
    </Form>
  );
};

// export const AssetSecurityForm = ({
//   onSubmit,
//   onCancel,
//   startDate,
//   data,
// }: AssetSecurityFormProps) => {
//   return { data };

//   const form = useForm<FormData>({
//     resolver: zodResolver(schema),
//     values: data
//       ? {
//           security: {
//             symbol: data?.security.symbol,
//             name: data?.security.name,
//             sourceIdentifier: data?.security.sourceIdentifier,
//             exchange: data?.security.exchange ?? undefined,
//             country: data?.security.country ?? undefined,
//             currency: data?.security.currency ?? undefined,
//             type: data?.security.type ?? undefined,
//             isin: data?.security.isin,
//             cusip: data?.security.cusip ?? undefined,
//             figi: data?.security.figi ?? undefined,
//           },
//           shareHolding: data?.calculatedValue.value,
//           currencyValue: data?.calculatedValue.value,
//           priorGainLoss: createDecimalValueString("0"),
//           startDate: data?.startDate,
//         }
//       : undefined,

//     defaultValues: {
//       security: undefined,
//       shareHolding: createDecimalValueString("0"),
//       currencyValue: createDecimalValueString("0"),
//       priorGainLoss: "",
//       startDate: startDate ?? new Date(),
//     },
//     mode: "onBlur",
//   });

//   const {
//     control,
//     watch,
//     formState: { errors, isValid },
//     getValues,
//   } = form;

//   const gl = watch("priorGainLoss");
//   console.log("priorGainLoss", gl);
//   console.log("priorGainLoss", typeof gl);

//   const security = watch("security");

//   return (
//     <>
//       <Form {...form}>
//         <FormDescription>Search by Name / Ticker / ISIN</FormDescription>
//         {data ? (
//           <span>Security: {data.security.name}</span>
//         ) : (
//           <AssetSecurityNewFields />
//         )}

//         <AssetSecurityBaseFields startDate={startDate} />

//         <div className="flex flex-row gap-2">
//           <Button variant="outline" onClick={() => onCancel()}>
//             Cancel
//           </Button>
//           <Button
//             onClick={() => {
//               if (isValid) {
//                 onSubmit(getValues());
//               }
//             }}
//             disabled={!isValid}
//           >
//             Add
//           </Button>
//         </div>
//       </Form>
//     </>
//   );
// };

type AssetSecurityNewFields = Pick<
  UserAssetSecurityWithInitialValuesInsert,
  "shareHolding" | "currencyValue"
> & {
  security: SecurityInsert | undefined;
};

const AssetSecurityNewFields = () => {
  const { control, watch, setValue } = useFormContext<AssetSecurityNewFields>();

  const [searchInput, setSearchInput] = useState("");

  const security = watch("security");

  const setSelectedSecurity = (security: SecurityInsert | null) => {
    setValue("security", security ?? undefined);
  };

  // const [selectedSecurity, setSelectedSecurity] =
  //   useState<SecuritySearchResult | null>(null);

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
      <RSelect
        options={securities ?? []}
        getOptionLabel={(security) => `${security.symbol} - ${security.name}`}
        value={security}
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
            <FormLabel>Currency Value</FormLabel>
            <FormDescription>
              The currency paid for the security to date.
            </FormDescription>
            <FormControl>
              <Input
                type="number"
                placeholder="Currency Value"
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
  console.log("AssetSecurityBaseFields startDate", startDate, typeof startDate);
  return (
    <>
      {startDate && !startDateIsEditable ? (
        <span>Start Date: {startDate.toLocaleDateString()}</span>
      ) : (
        <FormField
          control={control}
          name="startDate"
          render={() => (
            <FormItem>
              <FormLabel>Select Start Date</FormLabel>
              <FormDescription>
                When did you start this security?{" "}
              </FormDescription>
              <Controller
                control={control}
                name="startDate"
                rules={{ required: true }}
                render={({ field }) => {
                  return (
                    <Input
                      type="date"
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      //Typescript can not use descrimator for AssetSecurityBaseFieldsProps in here, so we shebang it
                      min={
                        startDateMin?.toISOString().split("T")[0] ?? undefined
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
    </>
  );
}; 
