import type {
  AssetSecurityLike,
  UserAssetOrphanInsert,
  DecimalValueString,
  UserAssetSecurityOrphanNewCreateInsert,
} from "@shared/schema";
import {
  accountType,
  userAssetOrphanInsertSchema,
  userAssetOrphanInsertDraftSchema,
  createDecimalValueString,
} from "@shared/schema";
import {
  useForm,
  useFormContext,
  useFieldArray,
  FieldErrors,
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
import { Input } from "../ui/input";
import { DateInput } from "../ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "../ui/sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraftState } from "@/hooks/use-draft-state";
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

type AccountCreateDraft = {
  formStage: number;
  formValues: Partial<UserAssetOrphanInsert>;
};

export const DRAFT_KEY = "draft:add-account";

export const AccountCreate: React.FC<AccountCreateProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [draft, setDraft, clearDraft] = useDraftState<AccountCreateDraft>(
    DRAFT_KEY,
    { formStage: 1, formValues: {} }
  );

  const hasDraftValues = !!draft.formValues.accountType;

  const parsedDraft = hasDraftValues
    ? userAssetOrphanInsertDraftSchema.safeParse(draft.formValues)
    : null;

  const form = useForm<UserAssetOrphanInsert>({
    resolver: zodResolver(userAssetOrphanInsertSchema),
    mode: "all",
    defaultValues: parsedDraft?.success
      ? parsedDraft.data
      : hasDraftValues
        ? draft.formValues
        : { name: `account-${generateId()}`, valueMethod: "calculated" },
  });

  const formStage = draft.formStage;
  const formStageRef = useRef(formStage);
  formStageRef.current = formStage;

  useEffect(() => {
    const { unsubscribe } = form.watch((values) => {
      setDraft({
        formStage: formStageRef.current,
        formValues: values as Partial<UserAssetOrphanInsert>,
      });
    });
    return unsubscribe;
  }, []);

  const setFormStage = (stage: number) => {
    setDraft({ formStage: stage, formValues: form.getValues() });
  };

  const submitForm = (data: UserAssetOrphanInsert) => {
    return onSubmit(data).then(() => {
      clearDraft();
      form.reset();
    });
  };

  const handleCancel = () => {
    clearDraft();
    onCancel();
  };

  const stage1Fields: (keyof UserAssetOrphanInsert)[] = ["platformId", "accountType", "startDate"];
  const stage2Fields: (keyof UserAssetOrphanInsert)[] = ["valueMethod", "securities", "currentValue"];
  const stage3Fields: (keyof UserAssetOrphanInsert)[] = ["contributions"];

  const onSubmitError = (errors: FieldErrors<UserAssetOrphanInsert>) => {
    if (stage1Fields.some((f) => f in errors)) return setFormStage(1);
    if (stage2Fields.some((f) => f in errors)) return setFormStage(2);
    if (stage3Fields.some((f) => f in errors)) {
      // User is already on stage 3; force trigger to surface inline field errors
      // in case the beforeSubmit trigger did not catch them (e.g. stale contributions.type).
      form.trigger("contributions");
      return;
    }
    // Truly unexpected Zod path — surface via root error banner.
    form.setError("root", {
      type: "manual",
      message: "Some information is invalid. Please review and try again.",
    });
  };

  const handleNext = async () => {
    setFormStage(formStage + 1);
  };

  const { handleSubmit, formState: { errors } } = form;

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h1 className="text-2xl font-bold">
          Add Investment Account
        </h1>
      </div>
      <Form {...form}>
        <form onSubmit={handleSubmit(submitForm, onSubmitError)} className="space-y-4">
          {formStage === 1 && (
            <AccountCreateOne
              onNext={handleNext}
              onCancel={handleCancel}
            />
          )}
          {formStage === 2 && (
            <AccountCreateTwo
              onNext={handleNext}
              onBack={() => setFormStage(1)}
              onCancel={handleCancel}
            />
          )}
          {formStage === 3 && (
            <AccountCreateThree
              onBack={() => setFormStage(2)}
              onCancel={handleCancel}
              canSubmit={true}
            />
          )}
          {errors.root && (
            <p className="text-sm font-medium text-destructive">
              {errors.root.message}
            </p>
          )}
        </form>
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
        <Button
          type="submit"
          disabled={isProcessing || submitDisabled}
        >
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

  const startDateInstructions = selectedPlatform
    ? `Insert instruction for ${selectedPlatform.name} here`
    : undefined;

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
        render={({ field }) => (
          <FormItem>
            <FormLabel>Start Date</FormLabel>
            <FormDescription>When did you start this account?</FormDescription>
            <DateInput
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              disabled={field.disabled}
            />
            <FormMessage />
            {selectedPlatform && (
              <Sheet>
                <SheetTrigger asChild>
                  <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">
                    How do I find this?
                  </button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Finding your start date</SheetTitle>
                    <SheetDescription>
                      Instructions for {selectedPlatform.name}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-4 overflow-y-auto">
                    <p className="text-sm">{startDateInstructions}</p>
                  </div>
                </SheetContent>
              </Sheet>
            )}
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
      startDate: startDate ?? new Date(),
      initialHolding: {
        shareHolding: createDecimalValueString("0"),
        currencyValue: createDecimalValueString("0"),
      },
      fundedFromCash: true,
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

  const canNext = valueMethod === "calculated";
  // TODO: re-enable manual value method — (valueMethod === "manual" && currentValueFieldState.isDirty && !currentValueFieldState.invalid)

  const handleNext = async (next: () => void) => {
    // TODO: re-enable manual value method — was: valueMethod === "calculated" ? ["valueMethod", "securities"] : ["valueMethod", "currentValue"]
    const triggerFields: (keyof UserAssetOrphanInsert)[] = ["valueMethod", "securities"];
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
          {/* TODO: re-enable manual value method
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
                          the investments you tell us are held in the account
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
          */}
          {valueMethod === "calculated" ? (
            <>
              <FormField
                control={form.control}
                name="securities"
                render={({ field }) => (
                  <>
                    <div>
                      <FormLabel>Add Investments</FormLabel>
                      <FormDescription>
                        In order to calculate the value of your account, we need to
                        know which investments are held in the account
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
                        Add Investment
                      </Button>
                    </div>
                    <FormMessage />
                  </>
                )}
              />
              <FormField
                control={form.control}
                name="initialCashHolding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Cash Balance</FormLabel>
                    <FormDescription>
                      Optionally set the uninvested cash held in this account
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : e.target.value)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
          {/* TODO: re-enable manual value method
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
          */}
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
        <span>Shares Held:</span>
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

  const startDate = watch("startDate");
  const contributions = watch("contributions");
  // isScheduled is derived from form state so it survives stage navigation.
  // contributions being defined means the user has opted in to scheduled contributions.
  const isScheduled = contributions !== undefined;

  const handleScheduledToggle = (value: string) => {
    if (value === "yes") {
      setValue(
        "contributions",
        {
          type: (valueMethod === "calculated" && securitiesForGroup.length > 0) ? "security" : "asset",
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
        },
        { shouldDirty: true }
      );
    } else {
      setValue("contributions", undefined, { shouldDirty: true });
    }
  };

  const recurringProps: RecurringContributionFormProps =
    valueMethod === "calculated" && securitiesForGroup.length > 0
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

  const canNext = isScheduled ? contributionsAmountIsPositive : true;

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
            onValueChange={handleScheduledToggle}
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
      {isScheduled && !canNext && (
        <p className="text-sm text-muted-foreground">
          Enter a contribution amount greater than zero to continue.
        </p>
      )}
      <ActionsBar {...actionsBarProps} isProcessing={isSubmitting} />
    </>
  );
};
