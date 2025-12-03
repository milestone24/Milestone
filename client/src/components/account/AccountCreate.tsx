import type {
  AssetSecurityLike,
  RecurringContributionGroupInsert,
  UserAssetOrphanInsert,
  UserAssetSecurityWithInitialValuesInsert,
  UserAssetSecurityInsert,
  DecimalValueString,
  SecuritySelect,
} from "@shared/schema";
import {
  accountType,
  userAssetOrphanInsertSchema,
  createDecimalValueString,
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
import { Button } from "../ui/button";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { withTransform } from "@/lib/utils/mappers";
import { Switch } from "../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { RRuleScheduler } from "../schedule/RRuleScheduler";
import { AssetSecurityNewForm } from "./AssetSecurityForm";
import {
  RecurringContributionForm,
  RecurringContributionFormProps,
} from "./RecurringContributionForm";
import { createRRulePattern } from "@shared/utils/scheduling";

const contributionsDefaultValues: Partial<RecurringContributionGroupInsert> = {
  process: "manual",
  patternConfig: {
    type: "rrule",
    expression: "",
  },
};

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
    resolver: withTransform(
      zodResolver(userAssetOrphanInsertSchema),
      (values) => ({
        ...values,
        currentValue: values.currentValue
          ? typeof values.currentValue === "string"
            ? createDecimalValueString(values.currentValue)
            : typeof values.currentValue === "number"
            ? createDecimalValueString(String(values.currentValue))
            : createDecimalValueString(String(values.currentValue))
          : createDecimalValueString("0"),
        securities:
          values.securities?.map((security) => ({
            ...security,
            shareHolding: security.shareHolding
              ? typeof security.shareHolding === "string"
                ? createDecimalValueString(security.shareHolding)
                : typeof security.shareHolding === "number"
                ? createDecimalValueString(String(security.shareHolding))
                : createDecimalValueString(String(security.shareHolding))
              : createDecimalValueString("0"),
            currencyValue: security.currencyValue
              ? typeof security.currencyValue === "string"
                ? createDecimalValueString(security.currencyValue)
                : typeof security.currencyValue === "number"
                ? createDecimalValueString(String(security.currencyValue))
                : createDecimalValueString(String(security.currencyValue))
              : createDecimalValueString("0"),
            priorGainLoss: security.priorGainLoss
              ? typeof security.priorGainLoss === "string"
                ? createDecimalValueString(security.priorGainLoss)
                : typeof security.priorGainLoss === "number"
                ? createDecimalValueString(String(security.priorGainLoss))
                : createDecimalValueString(String(security.priorGainLoss))
              : createDecimalValueString("0"),
          })) ?? [],
        contributions: values.contributions
          ? values.contributions.type === "security"
            ? {
                type: "security",
                isActive: true,
                process: values.contributions.process,
                amount: values.contributions.amount
                  ? typeof values.contributions.amount === "string"
                    ? createDecimalValueString(values.contributions.amount)
                    : typeof values.contributions.amount === "number"
                    ? createDecimalValueString(
                        String(values.contributions.amount)
                      )
                    : createDecimalValueString(
                        String(values.contributions.amount)
                      )
                  : createDecimalValueString("0"),
                startDate: values.startDate,
                // notificationPeriod:
                //   values.contributions?.notificationPeriod ?? "weekly",
                patternConfig: values.contributions?.patternConfig,
                notificationEmail:
                  values.contributions?.notificationEmail === true
                    ? true
                    : false,
                notificationPush:
                  values.contributions?.notificationPush === true
                    ? true
                    : false,
                securityDistribution:
                  values.contributions?.securityDistribution?.map(
                    (security) => ({
                      ...security,
                      commitment: security.commitment
                        ? typeof security.commitment === "string"
                          ? createDecimalValueString(security.commitment)
                          : typeof security.commitment === "number"
                          ? createDecimalValueString(
                              String(security.commitment)
                            )
                          : createDecimalValueString(
                              String(security.commitment)
                            )
                        : createDecimalValueString("0"),
                    })
                  ) ?? [],
              }
            : values.contributions.type === "asset"
            ? {
                type: "asset",
                isActive: true,
                process: values.contributions.process,
                amount: values.contributions.amount
                  ? typeof values.contributions.amount === "string"
                    ? createDecimalValueString(values.contributions.amount)
                    : typeof values.contributions.amount === "number"
                    ? createDecimalValueString(
                        String(values.contributions.amount)
                      )
                    : createDecimalValueString(
                        String(values.contributions.amount)
                      )
                  : createDecimalValueString("0"),
                startDate: values.startDate,
                patternConfig: values.contributions?.patternConfig,
                notificationEmail:
                  values.contributions?.notificationEmail === true
                    ? true
                    : false,
                notificationPush:
                  values.contributions?.notificationPush === true
                    ? true
                    : false,
              }
            : undefined
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
      // contributions: {
      //   process: "manual",
      //   patternConfig: {
      //     type: "rrule",
      //     expression: "",
      //   },
      //   securityDistribution: [],
      // },
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
    watch,
    getValues,
  } = form;

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
  console.log("isProcessing", isProcessing);

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
              <Loader2 className="w-4 h-4 animate-spin" />
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
    isProcessing: isSubmitting,
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

  const handleAddSecurity = (
    security: UserAssetSecurityWithInitialValuesInsert
  ) => {
    append({
      ...security,
      lid: crypto.randomUUID(),
    });
    setAddingSecurity(false);
  };

  return (
    <>
      {addingSecurity ? (
        <AssetSecurityNewForm
          onCancel={() => setAddingSecurity(false)}
          onSubmit={handleAddSecurity}
          startDate={startDate}
          startDateMin={startDate}
          startDateIsEditable={false}
        />
      ) : (
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
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                  >
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
                          We will calculate the value of your account based on
                          the securities you tell us are held in the account
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
                          You will need to manually enter the value of your
                          account each time
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
                  In order to calculate the value of your account, we need to
                  know which securities are held in the account
                </FormDescription>
              </div>
              <div className="space-y-2 flex flex-col gap-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-row gap-2 items-start"
                  >
                    <div className="flex-1">
                      <SecurityCard security={field} />
                    </div>
                    <Button variant="outline" onClick={() => remove(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={() => setAddingSecurity(true)}>
                  Add Security
                </Button>
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
                    <Input
                      type="number"
                      placeholder="Initial Value"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <ActionsBar {...props} isProcessing={isSubmitting} />
        </>
      )}
    </>
  );
};

type SecurityCardProps = {
  security: {
    id: string;
    security: {
      symbol: string;
      name: string;
    };
    shareHolding: DecimalValueString;
    currencyValue: DecimalValueString;
    startDate: Date;
  };
};

const SecurityCard = ({ security }: SecurityCardProps) => {
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

const AccountCreateThree: React.FC<AccountCreateFormProps> = (props) => {
  const form = useFormContext<UserAssetOrphanInsert>();

  const {
    watch,
    formState: { isSubmitting },
    setValue,
  } = form;

  const securities = watch("securities");
  const valueMethod = watch("valueMethod");
  const securitiesForGroup: AssetSecurityLike[] =
    securities?.map((security) => ({
      ...security,
      //We add a temp id here purely for identity mapping in proceeding creation steps
      id: security.lid,
      isTempSecurityId: true,
    })) ?? [];

  const [isScheduled, setIsScheduled] = useState<boolean>(false);

  const startDate = watch("startDate");

  useEffect(() => {
    setValue(
      "contributions",
      isScheduled
        ? {
            type: valueMethod === "calculated" ? "security" : "asset",
            notificationEmail: false,
            notificationPush: false,
            isActive: true,
            startDate: startDate ?? new Date(),
            amount: createDecimalValueString("0"),
            process: "manual",
            patternConfig: {
              type: "rrule",
              expression: createRRulePattern(
                "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1"
              ).expression,
            },
            securityDistribution: [],
          }
        : undefined,
      { shouldDirty: true }
    );
  }, [isScheduled]);

  const recurringProps: RecurringContributionFormProps =
    valueMethod === "calculated"
      ? {
          type: "security",
          securities: securitiesForGroup,
        }
      : {
          type: "asset",
          securities: undefined,
        };

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
            onValueChange={(value) => setIsScheduled(value === "yes")}
            className="mb-4"
          >
            <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
            <ToggleGroupItem value="no">No</ToggleGroupItem>
          </ToggleGroup>
        </FormControl>
      </div>

      {isScheduled ? (
        <>
          <RecurringContributionForm {...recurringProps} />
        </>
      ) : null}
      <ActionsBar {...props} isProcessing={isSubmitting} />
    </>
  );
};
