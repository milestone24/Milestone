import type {
  AssetSecurityLike,
  UserAssetOrphanInsert,
  DecimalValueString,
  UserAssetSecurityOrphanNewCreateInsert,
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
import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  AssetSecurityNewFormData,
  AssetSecurityNewFormFields,
} from "./AssetSecurityForm";
import { userAssetSecurityOrphanNewCreateInsertSchema } from "@shared/schema/portfolio-assets";
import {
  RecurringContributionForm,
  RecurringContributionFormProps,
} from "./RecurringContributionForm";
import { createRRulePattern } from "@shared/utils/scheduling";
import { generateId } from "@shared/utils/id"
import Decimal from "decimal.js";

type AccountCreateProps = {
  onSubmit: (data: UserAssetOrphanInsert) => Promise<void>;
  onCancel: () => void;
};

type ActionsBarProps = {
  onCancel: () => void;
  onBack?: () => void;
  isProcessing: boolean;
}
& (
  |
  {
    canSubmit: true;
    submitDisabled: boolean;
  }
  | {
    canSubmit?: false;
    submitDisabled?: undefined;
  }
)
& (
  | {
    onNext: () => void;
    nextDisabled: boolean;
  }
  | {
    onNext?: undefined;
    nextDisabled?: undefined;
  }
)

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

  const name = `account-${generateId()}`

  const form = useForm<UserAssetOrphanInsert>({
    resolver: zodResolver(userAssetOrphanInsertSchema),
    mode: "all",
    defaultValues: {
      name,
      valueMethod: "calculated",
    },
  });

  const [formStage, setFormStage] = useState<number>(1);

  const submitForm = (data: UserAssetOrphanInsert) => {
    return onSubmit(data).then(() => {
      form.reset();
    });
  };

  const handleNext = async () => {
    setFormStage(formStage + 1);
  };

  const { handleSubmit } = form;

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h1 className="text-2xl font-bold">
          Add Investment Account
        </h1>
      </div>
      <Form {...form}>
        <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
          {formStage === 1 && (
            <AccountCreateOne
              onNext={handleNext}
              onCancel={onCancel}
            />
          )}
          {formStage === 2 && (
            <AccountCreateTwo
              onNext={handleNext}
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
  nextDisabled,
  onBack,
  isProcessing,
  canSubmit,
  submitDisabled,
}: ActionsBarProps) => {
  console.log("actions bar isProcessing", isProcessing);

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
          disabled={nextDisabled}
        >
          Next
        </Button>
      ) : null}
      {canSubmit === true ? (
        <Button type="submit" disabled={isProcessing || submitDisabled}>
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {` Adding Account...`}
            </>
          ) : (
            "Add Account"
          )}
        </Button>
      ) : null}
    </section>
  );
};

const PhaseHeading = ({ heading }: { heading: string }) => {
  return (
    <div className="flex flex-row justify-between items-center">
      <h2 className="text-md">{heading}</h2>
    </div>
  );  
};

const AccountCreateOne: React.FC<AccountCreateFormProps> = (props) => {

  const { onNext, canSubmit, ...restProps } = props;

  const form = useFormContext<UserAssetOrphanInsert>();

  const {
    formState: { isSubmitting },
  } = form;

  const { data: brokerPlatforms, isLoading: isLoadingBrokerPlatforms } =
    useBrokerPlatforms();

  const selectedPlatformId = form.watch("platformId");
  const selectedPlatform = brokerPlatforms?.find(
    (p) => p.id === selectedPlatformId
  );

  const accountTypeFieldState = form.getFieldState("accountType");
  const startDateFieldState = form.getFieldState("startDate");

  const canNext = (
    (!accountTypeFieldState.invalid && accountTypeFieldState.isDirty) &&
    (!startDateFieldState.invalid && startDateFieldState.isDirty)
  );

  const handleNext = async (next: () => void) => {
    const isValid = await form.trigger(["accountType", "startDate"]);
    if (isValid) {
      next();
    }
  }

  //TODO: create helper function for this
  const actionsBarProps:ActionsBarProps = {
    ...restProps,
    isProcessing: isSubmitting,
    ...(onNext ? {
      onNext: () => handleNext(onNext),
      nextDisabled: !canNext,
    } : {
      onNext: undefined,
      nextDisabled: undefined,
    }),
    ...(canSubmit ? {
      canSubmit: true,
      submitDisabled: !canNext,
    } : {
      canSubmit: false,
      submitDisabled: undefined,
    }),
  };

  const selectableAccountTypes = useMemo(() =>
    {
      return (selectedPlatform
        ? selectedPlatform.supportedAccountTypes
        : accountType)
        .filter((type) => type !== "OTHER")
    }
  , [selectedPlatform, accountType])

  const startDateInstructions = useMemo(() => {
    return (selectedPlatform
      ? `Insert instruction for ${selectedPlatform.name} here`
      : "We can only provide instructions for a known platform.")
  }, [selectedPlatform])

  return (
    <>
      <PhaseHeading heading="1) Account Details" />
      {/* TODO: Being able to add a cutom account name is temporarily disabled. */}
      {/* <span className="text-sm text-gray-500">{name}</span> */}
      {/* <FormField
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
      /> */}
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
              Did you use an investment platform to manage your asset?
            </FormDescription>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              disabled={isLoadingBrokerPlatforms}
              name={field.name}
            >
              <FormControl>
                <SelectTrigger
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                >
                  <SelectValue placeholder="Select Platform" />
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
            <Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}>
              <FormControl>
                <SelectTrigger
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  name={field.name}
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {selectableAccountTypes.map((type) => (
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
            <FormLabel>Start Date</FormLabel>
            <FormDescription>When did you start this account?</FormDescription>
            <Controller
              control={form.control}
              name="startDate"
              rules={{ required: true }}
              render={({ field }) => (
                <Input
                  type="date"
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  disabled={field.disabled}
                  value={
                    field.value ? field.value.toISOString().split("T")[0] : ""
                  }
                />
              )}
            />
            <FormMessage />
            <FormDescription>How do I find this?
              <p>{startDateInstructions}</p>
            </FormDescription>
          </FormItem>
        )}
      />

      <section>
        <ActionsBar {...actionsBarProps} isProcessing={isSubmitting} />
      </section>
    </>
  );
};

type AssetSecurityFormProps = {
  onSubmit: (value: AssetSecurityNewFormData) => Promise<void>;
  onCancel: () => void;
  startDate: Date | undefined;
  startDateMin: Date | undefined;
  startDateIsEditable: boolean;
};

const AssetSecurityForm = ({
  onSubmit,
  onCancel,
  startDate,
  startDateMin,
  startDateIsEditable,
}: AssetSecurityFormProps) => {
  const form = useForm<AssetSecurityNewFormData>({
    resolver: zodResolver(userAssetSecurityOrphanNewCreateInsertSchema),
    defaultValues: {
      type: "new",
      priorGainLoss: createDecimalValueString("0"),
      startDate: startDate ?? new Date(),
      initialHolding: {
        shareHolding: createDecimalValueString("0"),
        currencyValue: createDecimalValueString("0"),
      },
    },
    mode: "all",
  });

  const {
    formState: { isValid, isSubmitting },
  } = form;

  const handleAdd = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    await onSubmit(form.getValues());
  };

  return (
    <Form {...form}>
      <AssetSecurityNewFormFields
        startDate={startDate}
        startDateMin={startDateMin}
        startDateIsEditable={startDateIsEditable}
      />
      <div className="flex flex-row justify-end gap-2 mt-8">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
        </Button>
      </div>
    </Form>
  );
};

const AccountCreateTwo: React.FC<AccountCreateFormProps> = (props) => {

  const { onNext, canSubmit, ...restProps } = props;

  const form = useFormContext<UserAssetOrphanInsert>();

  const { watch } = form;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "securities",
  });

  const [addingSecurity, setAddingSecurity] = useState<boolean>(false);

  const valueMethod = watch("valueMethod");
  const startDate = watch("startDate");
  const securities = watch("securities");

  const {
    formState: { isSubmitting },
  } = form;

  const handleAddSecurity = (
    security: UserAssetSecurityOrphanNewCreateInsert
  ) => {
    append({
      ...security,
      lid: crypto.randomUUID(),
    });
    setAddingSecurity(false);
    //We add this to satisfy the API of the form.
    return Promise.resolve();
  };

  const currentValueFieldState = form.getFieldState("currentValue");

  const canNext = (
      ((valueMethod === "calculated" && (securities?.length ?? 0) > 0) ||
      (valueMethod === "manual" && currentValueFieldState.isDirty && !currentValueFieldState.invalid))
  );

  const handleNext = async (next: () => void) => {
    const triggerFields: (keyof UserAssetOrphanInsert)[] = valueMethod === "calculated" ? ["valueMethod", "securities"] : ["valueMethod", "currentValue"];
    const isValid = await form.trigger(triggerFields);
    if (isValid) {
      next();
    }
  }

  //TODO: create helper function for this
  const actionsBarProps:ActionsBarProps = {
    ...restProps,
    isProcessing: isSubmitting,
    ...(onNext ? {
      onNext: () => handleNext(onNext),
      nextDisabled: !canNext,
    } : {
      onNext: undefined,
      nextDisabled: undefined,
    }),
    ...(canSubmit ? {
      canSubmit: true,
      submitDisabled: !canNext,
    } : {
      canSubmit: false,
      submitDisabled: undefined,
    }),
  };

  return (
    <>
      <PhaseHeading heading="2) Account Value" />
      {addingSecurity ? (
        <>
          <span className="text-md">Adding Security</span>
          <AssetSecurityForm
            onCancel={() => setAddingSecurity(false)}
            onSubmit={handleAddSecurity}
            startDate={startDate}
            startDateMin={startDate}
            startDateIsEditable={false}
          />
        </>
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
            <FormField
              control={form.control}
              name="securities"
              render={({ field }) => (
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
                  <FormMessage />
                </>
            )}
          />
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
          <ActionsBar {...actionsBarProps} isProcessing={isSubmitting}/>
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
    initialHolding: {
      shareHolding: DecimalValueString;
      currencyValue: DecimalValueString;
    };
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
        <span>{security.initialHolding.shareHolding}</span>
      </div>
      <div className="flex flex-row gap-2 text-sm">
        <span>Currency Value:</span>
        <span>{security.initialHolding.currencyValue}</span>
      </div>
      <div className="flex flex-row gap-2 text-sm">
        <span>Start Date:</span>
        <span>{security.startDate?.toLocaleDateString() || "N/A"}</span>
      </div>
    </div>
  );
};

const AccountCreateThree: React.FC<AccountCreateFormProps> = (props) => {

  const { onNext, canSubmit, ...restProps } = props;

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

  const contributionsAmount = watch("contributions.amount");
  const contributionsAmountIsPositive = contributionsAmount ? Decimal(contributionsAmount).gt(0) : false;
  
  const contributionsFieldState = form.getFieldState("contributions.amount");

  const canNext = isScheduled ? (
    (!contributionsFieldState.invalid && contributionsFieldState.isDirty && contributionsAmountIsPositive)
  ) : true;

  const actionsBarProps:ActionsBarProps = {
    ...restProps,
    isProcessing: isSubmitting,
    onNext: undefined,
    nextDisabled: undefined,
    ...(canSubmit ? {
      canSubmit: true,
      submitDisabled: !canNext,
    } : {
      canSubmit: false,
      submitDisabled: undefined,
    }),
  };

  return (
    <>
      <PhaseHeading heading="3) Schedule" />

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
      <ActionsBar {...actionsBarProps} isProcessing={isSubmitting} />
    </>
  );
};
