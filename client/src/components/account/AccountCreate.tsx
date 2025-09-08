import {
  userAssetOrphanInsertSchema,
  UserAssetOrphanInsert,
  SecuritySearchResult,
  UserAssetInsertSecurityItem,
  accountType,
} from "@shared/schema";
import {
  useForm,
  useFormContext,
  useFieldArray,
  Controller,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import RSelect from "react-select";
import { Button } from "../ui/button";
import { useFindSecurities } from "@/hooks/use-find-securities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { withTransform } from "@/lib/utils/mappers";
import { Switch } from "../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { RRuleScheduler } from "../schedule/RRuleScheduler";

type AccountCreateProps = {
  onSubmit: (data: UserAssetOrphanInsert) => void;
  onCancel: () => void;
};

type ActionsBarProps = {
  onCancel: () => void;
  onNext?: () => void;
  onBack?: () => void;
  canSubmit?: boolean;
  isProcessing: boolean;
};

type AccountCreateFormProps = {
  onCancel: () => void;
  onNext?: () => void;
  onBack?: () => void;
  canSubmit?: boolean;
};

export const AccountCreate: React.FC<AccountCreateProps> = ({
  onSubmit,
  onCancel,
}) => {
  const form = useForm<UserAssetOrphanInsert>({
    //resolver: zodResolver(brokerProviderAssetOrphanInsertSchema),
    resolver: withTransform(
      zodResolver(userAssetOrphanInsertSchema),
      (values) => ({
        ...values,
        currentValue: values.currentValue
          ? typeof values.currentValue === "string"
            ? parseFloat(values.currentValue)
            : values.currentValue
          : 0,
        securities:
          values.securities?.map((security) => ({
            ...security,
            shareHolding: security.shareHolding
              ? typeof security.shareHolding === "string"
                ? parseFloat(security.shareHolding)
                : security.shareHolding
              : 0,
            currencyValue: security.currencyValue
              ? typeof security.currencyValue === "string"
                ? parseFloat(security.currencyValue)
                : security.currencyValue
              : 0,
            priorGainLoss: security.priorGainLoss
              ? typeof security.priorGainLoss === "string"
                ? parseFloat(security.priorGainLoss)
                : security.priorGainLoss
              : 0,
          })) ?? [],
        contributions: values.contributions
          ? {
              isScheduled: values.contributions?.isScheduled,
              process:
                values.valueMethod === "calculated"
                  ? "manual"
                  : values.contributions?.process,
              amount: values.contributions?.amount
                ? parseFloat(values.contributions.amount as unknown as string)
                : 0,
              date: new Date(),
              // notificationPeriod:
              //   values.contributions?.notificationPeriod ?? "weekly",
              schedulePattern: values.contributions?.schedulePattern,
              notificationEmail:
                values.contributions?.notificationEmail === true ? true : false,
              notificationPush:
                values.contributions?.notificationPush === true ? true : false,
              securityDistribution:
                values.contributions?.securityDistribution?.map((security) => ({
                  ...security,
                  commitment: security.commitment
                    ? typeof security.commitment === "string"
                      ? parseFloat(security.commitment)
                      : security.commitment
                    : 0,
                })) ?? [],
            }
          : undefined,
      })
    ),
    mode: "onChange",
    // defaultValues: {
    //   securities: [],
    //   contributions: {
    //     process: "automatic",
    //     securityDistribution: [],
    //   },
    // },
    defaultValues: {
      //name: "Mine Manual One",
      //platformId: "3d723d74-ecf5-49fa-a4d9-4c52c1842de7",
      //accountType: "ISA",
      //startDate: new Date("2025-01-01"),
      valueMethod: "calculated",
      contributions: {
        isScheduled: false,
        process: "manual",
        schedulePattern: {
          type: "rrule",
          expression: "",
        },
        securityDistribution: [],
      },
      // securities: [
      // {
      //   security: {
      //     symbol: "AAPL",
      //     name: "Apple Inc.",
      //   },
      //   shareHolding: 100,
      //   gainLoss: 100,
      // },
      //],
    },
  });

  const [formStage, setFormStage] = useState<number>(1);

  const submitForm = (data: UserAssetOrphanInsert) => {
    onSubmit(data);
    form.reset();
  };

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  console.log("isSubmitting", isSubmitting);

  // console.log("errors", errors);

  // console.log("form.getValues()", form.getValues());

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h1 className="text-2xl font-bold">
          Create an account step {formStage}
        </h1>
      </div>
      <Form {...form}>
        <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
          {formStage === 1 && (
            <AccountCreateOne
              onNext={() => setFormStage(2)}
              onCancel={onCancel}
            />
          )}
          {formStage === 2 && (
            <AccountCreateTwo
              onNext={() => setFormStage(3)}
              onBack={() => setFormStage(1)}
              onCancel={onCancel}
            />
          )}
          {formStage === 3 && (
            <AccountCreateThree
              onBack={() => setFormStage(2)}
              onCancel={onCancel}
              canSubmit={true}
            />
          )}
        </form>
        <FormMessage />
      </Form>
    </>
  );
};

const ActionsBar = ({
  onCancel,
  onNext,
  onBack,
  isProcessing,
  canSubmit,
}: ActionsBarProps) => {
  console.log("ActionsBar onNext", onNext);

  console.log("ActionsBar isProcessing", isProcessing);

  return (
    <section className="mt-4 flex justify-end flex-row gap-2">
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          Cancel
        </Button>
      ) : null}
      {onBack ? (
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
        >
          Back
        </Button>
      ) : null}
      {onNext ? (
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          Next
        </Button>
      ) : null}
      {canSubmit === true ? (
        <Button type="submit" disabled={isProcessing}>
          {isProcessing ? (
            <>
              <span className="mr-2">Processing...</span>
            </>
          ) : (
            "Add Account"
          )}
        </Button>
      ) : null}
    </section>
  );
};

const AccountCreateOne: React.FC<AccountCreateFormProps> = (props) => {
  const form = useFormContext<UserAssetOrphanInsert>();

  const {
    formState: { isSubmitting, errors },
  } = form;

  //console.log("errors", errors);

  // const { data: brokerProviders, isLoading: isLoadingBrokerProviders } =
  //   useBrokerProviders();

  const { data: brokerPlatforms, isLoading: isLoadingBrokerPlatforms } =
    useBrokerPlatforms();

  const selectedPlatformId = form.watch("platformId");
  const selectedPlatform = brokerPlatforms?.find(
    (p) => p.id === selectedPlatformId
  );

  const nameFieldState = form.getFieldState("name");
  const platformFieldState = form.getFieldState("platformId");
  const accountTypeFieldState = form.getFieldState("accountType");

  const canNext =
    !nameFieldState.invalid &&
    !platformFieldState.invalid &&
    !accountTypeFieldState.invalid;

  const actionsBarProps = {
    ...props,
    onNext: canNext ? props.onNext : undefined,
  };

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h2 className="text-lg font-bold">Account Details</h2>
      </div>
      <FormField
        control={form.control}
        name="name"
        rules={{ required: true }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Asset Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g. My Trading 212 ISA" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="platformId"
        rules={{
          required: true,
          validate: (value) => {
            if (!value) {
              return "Platform is required";
            } else if (!brokerPlatforms?.find((p) => p.id === value)) {
              return "Platform is invalid";
            }
            return true;
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Select Platform</FormLabel>
            <FormDescription>
              Did you use a broker platform to manage your assets?
            </FormDescription>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              disabled={isLoadingBrokerPlatforms}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {brokerPlatforms?.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="accountType"
        rules={{ required: true }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Select Account Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {selectedPlatform
                  ? selectedPlatform.supportedAccountTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))
                  : accountType.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="startDate"
        render={() => (
          <FormItem>
            <FormLabel>Select Start Date</FormLabel>
            <FormDescription>When did you start this account? </FormDescription>
            <Controller
              control={form.control}
              name="startDate"
              rules={{ required: true }}
              render={({ field }) => (
                <Input
                  type="date"
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                  value={
                    field.value ? field.value.toISOString().split("T")[0] : ""
                  }
                />
              )}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <section>
        <ActionsBar {...actionsBarProps} isProcessing={isSubmitting} />
      </section>
    </>
  );
};

const AccountCreateTwo: React.FC<AccountCreateFormProps> = (props) => {
  const form = useFormContext<UserAssetOrphanInsert>();

  const { watch } = form;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "securities",
  });

  const [addingSecurity, setAddingSecurity] = useState<boolean>(false);

  const valueMethod = watch("valueMethod");

  const startDate = watch("startDate");

  const {
    formState: { isSubmitting },
  } = form;

  return (
    <>
      <FormField
        control={form.control}
        name="valueMethod"
        rules={{ required: true }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Select Control</FormLabel>
            <FormDescription>
              How do you want to control this account?
            </FormDescription>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange}>
                <div className="flex flex-row gap-2 items-start">
                  <div className="flex flex-col gap-2 pt-2">
                    <RadioGroupItem
                      value="calculated"
                      id="calculated"
                      className="flex-shrink-0"
                    />
                  </div>
                  <div className="flex flex-col pt-1">
                    <label htmlFor="calculated">Calculated</label>
                    <span className="text-xs block">
                      We will calculate the value of your account based on the
                      securities you tell us are held in the account
                    </span>
                  </div>
                </div>
                <div className="flex flex-row gap-2 items-start">
                  <div className="flex flex-col gap-2 pt-2">
                    <RadioGroupItem
                      value="manual"
                      id="manual"
                      className="flex-shrink-0"
                    />
                  </div>
                  <div className="flex flex-col pt-1">
                    <label htmlFor="manual">Manual</label>
                    <span className="text-xs block">
                      You will need to manually enter the value of your account
                      each time
                    </span>
                  </div>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {valueMethod === "calculated" ? (
        <>
          <div>
            <FormLabel>Add Securities</FormLabel>
            <FormDescription>
              In order to calculate the value of your account, we need to know
              which securities are held in the account
            </FormDescription>
          </div>
          <div className="space-y-2 flex flex-col gap-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-row gap-2 items-start">
                <div className="flex-1">
                  <SecurityCard security={field} />
                </div>
                <Button variant="outline" onClick={() => remove(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {addingSecurity ? (
              <SecurityAddForm
                onCancel={() => setAddingSecurity(false)}
                onAdd={(security) => {
                  setAddingSecurity(false);
                  append({
                    ...security,
                    startDate,
                  });
                }}
              />
            ) : (
              <Button onClick={() => setAddingSecurity(true)}>
                Add Security
              </Button>
            )}
          </div>
        </>
      ) : null}
      {valueMethod === "manual" ? (
        <FormField
          control={form.control}
          name="currentValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial Value</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Initial Value" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      <ActionsBar {...props} isProcessing={isSubmitting} />
    </>
  );
};

// Debounce utility
function useDebouncedCallback<T extends (...args: any[]) => void>(
  cb: T,
  delay: number,
  minLength: number
) {
  const timeout = useRef<NodeJS.Timeout | null>(null);
  return useCallback(
    (...args: Parameters<T>) => {
      if (args[0].length < minLength) cb(...args);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => cb(...args), delay);
    },
    [cb, delay]
  );
}

/*
 * See https://react-select.com/components
 */
const SecurityOptions = ({
  innerProps,
  isFocused,
  isSelected,
  data,
}: {
  innerProps: any;
  isFocused: boolean;
  isSelected: boolean;
  data: any;
}) => {
  return <div {...innerProps}>{data.label}</div>;
};

type UserAssetInsertSecurityItemWithoutStartDate = Omit<
  UserAssetInsertSecurityItem,
  "startDate"
>;

const SecurityAddForm = ({
  onAdd,
  onCancel,
}: {
  onAdd: (value: UserAssetInsertSecurityItemWithoutStartDate) => void;
  onCancel: () => void;
}) => {
  const form = useForm<
    Partial<Omit<UserAssetInsertSecurityItemWithoutStartDate, "startDate">>
  >({
    //We need this as the form library does not use react-hook form effectively to allow valueAsNumber to work
    //And we really need a float anyway

    defaultValues: {
      security: undefined,
      shareHolding: 0,
      currencyValue: 0,
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
              <Input type="number" placeholder="Share Holdings" {...field} />
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
              <Input type="number" placeholder="Currency Value" {...field} />
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
      <div className="flex flex-row gap-2">
        <Button variant="outline" onClick={() => onCancel()}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (selectedSecurity) {
              onAdd({
                tempId: crypto.randomUUID(),
                security: selectedSecurity,
                shareHolding: form.getValues("shareHolding") || 0,
                currencyValue: form.getValues("currencyValue") || 0,
                priorGainLoss: form.getValues("priorGainLoss") || 0,
              } as UserAssetInsertSecurityItemWithoutStartDate);
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
    </>
  );
};

type SecurityCardProps = {
  security: UserAssetInsertSecurityItem & { id: string };
};

const SecurityCard = ({ security }: SecurityCardProps) => {
  console.log("Security card security : ", security);

  return (
    <div className="flex flex-col gap-1 p-2 border rounded-md">
      <div className="flex flex-row gap-2 text-ellipsis text-sm">
        <span className="text-sm">{security.security.symbol}</span>
        <span className="text-sm">{security.security.name}</span>
      </div>
      <div className="flex flex-row gap-2 text-sm">
        <span>Share Holdings:</span>
        <span>{security.shareHolding}</span>
      </div>
      <div className="flex flex-row gap-2 text-sm">
        <span>Currency Value:</span>
        <span>{security.currencyValue}</span>
      </div>
      <div className="flex flex-row gap-2 text-sm">
        <span>Start Date:</span>
        <span>{security.startDate?.toLocaleDateString() || "N/A"}</span>
      </div>
      {/* <div className="flex flex-row gap-2">
          <span className="text-sm">Name:</span>
          <span>{security.security.name}</span>
        </div>
        <div className="flex flex-row gap-2">
          <span className="text-sm">Share Holdings:</span>
          <span>{security.shareHolding}</span>
        </div>
        <div className="flex flex-row gap-2">
          <span className="text-sm">Gain/Loss:</span>
          <span>{security.gainLoss}</span>
        </div> */}
    </div>
  );
};

const useContributionSecurities = (
  securities: UserAssetInsertSecurityItem[]
) => {
  const form = useFormContext<UserAssetOrphanInsert>();

  const { fields: securitiesFields, append } = useFieldArray<
    UserAssetOrphanInsert,
    "contributions.securityDistribution",
    "id"
  >({
    control: form.control,
    name: "contributions.securityDistribution",
  });

  useEffect(() => {
    if (securities && securities.length > 0) {
      securities
        .map((security) => ({
          securityTempId: security.tempId,
          securityName: security.security.name,
          commitment: 0,
        }))
        .forEach((security) => {
          if (
            securitiesFields.find(
              (field) => field.securityTempId === security.securityTempId
            )
          ) {
            return;
          }

          append({
            securityTempId: security.securityTempId,
            securityName: security.securityName,
            commitment: security.commitment,
          });
        });
    }
  }, [securities, append]);

  return { securitiesFields };

  //return contributionSecurities;
};

const AccountCreateThree: React.FC<AccountCreateFormProps> = (props) => {
  console.log("AccountCreateThree props", props);

  const form = useFormContext<UserAssetOrphanInsert>();

  const {
    watch,
    formState: { isSubmitting },
    setValue,
  } = form;

  const securities = watch("securities");
  const valueMethod = watch("valueMethod");

  const { securitiesFields } = useContributionSecurities(securities);

  const process = watch("contributions.process");
  const isScheduled = watch("contributions.isScheduled");

  const handleSchedulePatternChange = useCallback(
    (value: string) => {
      setValue("contributions.schedulePattern", {
        type: "rrule",
        expression: value,
      });
    },
    [setValue]
  );

  const handleIsScheduledChange = useCallback(
    (value: boolean) => {
      if (isScheduled === value) return;
      setValue("contributions.isScheduled", value);
    },
    [setValue, isScheduled]
  );

  const schedulePattern = watch("contributions.schedulePattern");

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h2 className="text-lg font-bold">Schedule</h2>
      </div>

      <div className="flex flex-col gap-3 items-start">
        <FormLabel>Should this account have scheduled contributions?</FormLabel>
        <FormControl>
          <ToggleGroup
            type="single"
            value={isScheduled ? "yes" : "no"}
            onValueChange={(value) => handleIsScheduledChange(value === "yes")}
            className="mb-4"
          >
            <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
            <ToggleGroupItem value="no">No</ToggleGroupItem>
          </ToggleGroup>
        </FormControl>
      </div>

      {isScheduled ? (
        <>
          <RRuleScheduler
            value={schedulePattern?.expression}
            onChange={handleSchedulePatternChange}
          />

          {/* <div className="flex flex-row gap-2 text-sm">
          <span>Schedule Pattern:</span>
          <span>{rruleToHumanReadable(schedulePattern?.expression)}</span>
        </div> */}

          {valueMethod === "manual" ? (
            <div className="flex flex-col gap-3 items-start">
              <FormField
                control={form.control}
                name="contributions.process"
                render={({ field }) => (
                  <FormItem className="items-start justify-start">
                    <FormLabel>
                      Would you like use to add your contributions
                      automatically?
                    </FormLabel>
                    <FormControl className="items-start justify-start">
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={field.onChange}
                        className="mb-4"
                      >
                        <ToggleGroupItem value="automatic">Yes</ToggleGroupItem>
                        <ToggleGroupItem value="manual">No</ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}
          {valueMethod === "manual" && process === "automatic" ? (
            <>
              <FormField
                control={form.control}
                name="contributions.amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contribution Amount</FormLabel>
                    <FormDescription>
                      How much do you invest each month into this account?
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Contribution Amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* <FormField
                control={form.control}
                name="contributions.date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contribution Date</FormLabel>
                    <FormDescription>
                      The date of the contribution. (This should not be a date.
                      This should allow the user to select, for example 1st of
                      the month, every 3 months, etc.)
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder="Contribution Date"
                        {...field}
                        value={""}
                        disabled={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}

              {securitiesFields.length > 0 ? (
                <FormItem>
                  <FormLabel>Security Distribution</FormLabel>
                  <FormDescription>
                    How is the money distributed between the securities?
                  </FormDescription>
                  {securitiesFields.map((security, index) => (
                    <div
                      key={security.id}
                      className="flex flex-row gap-2 items-center"
                    >
                      <span className="text-sm flex-1">
                        {security.securityName}
                      </span>
                      <FormField
                        control={form.control}
                        name={`contributions.securityDistribution.${index}.commitment`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl className="flex flex-row gap-2">
                              <Input
                                type="number"
                                placeholder="Commitment"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </FormItem>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-row gap-2 items-center">
                <p>We'll remind you to manually add your contributions.</p>
              </div>
              {/* <FormField
              control={form.control}
              name="contributions.notificationPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Period</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select notification period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
              <FormField
                control={form.control}
                name="contributions.notificationEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Notifications</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contributions.notificationPush"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Push Notifications</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )}
        </>
      ) : null}
      <ActionsBar {...props} isProcessing={isSubmitting} />
    </>
  );
};
