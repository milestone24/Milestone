import {
  brokerProviderAssetOrphanInsertSchema,
  BrokerProviderAssetOrphanInsert,
  BrokerProviderInsertSecurityItem,
  SecuritySearchResult,
  brokerProviderAssetSecurityInsertSchema,
} from "@shared/schema";
import { useForm, useFormContext, useFieldArray } from "react-hook-form";
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
import { useBrokerProviders } from "@/hooks/use-broker-providers";
import { Button } from "../ui/button";
import { useFindSecurities } from "@/hooks/use-find-securities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { withTransform } from "@/lib/utils/mappers";
import { Switch } from "../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

type AccountCreateProps = {
  onSubmit: (data: BrokerProviderAssetOrphanInsert) => void;
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
  const form = useForm<BrokerProviderAssetOrphanInsert>({
    //resolver: zodResolver(brokerProviderAssetOrphanInsertSchema),
    resolver: withTransform(
      zodResolver(brokerProviderAssetOrphanInsertSchema),
      (values) => ({
        ...values,
        securities:
          values.securities?.map((security) => ({
            ...security,
            shareHolding: security.shareHolding
              ? typeof security.shareHolding === "string"
                ? parseFloat(security.shareHolding)
                : security.shareHolding
              : 0,
            gainLoss: security.gainLoss
              ? typeof security.gainLoss === "string"
                ? parseFloat(security.gainLoss)
                : security.gainLoss
              : 0,
          })) ?? [],
        contributions: {
          process: "automatic",
          amount: values.contributions?.amount
            ? parseFloat(values.contributions.amount as string)
            : 0,
          date: new Date(),
          notificationPeriod:
            values.contributions?.notificationPeriod ?? "weekly",
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
        },
      })
    ),
    mode: "onBlur",
    defaultValues: {
      securities: [],
      contributions: {
        process: "automatic",
        securityDistribution: [],
      },
    },
    // defaultValues: {
    //   name: "Mine 3",
    //   providerId: "3d723d74-ecf5-49fa-a4d9-4c52c1842de7",
    //   accountType: "ISA",
    //   securities: [
    //     {
    //       security: {
    //         symbol: "AAPL",
    //         name: "Apple Inc.",
    //       },
    //       shareHolding: 100,
    //       gainLoss: 100,
    //     },
    //   ],
    // },
  });

  const [formStage, setFormStage] = useState<number>(1);

  const submitForm = (data: BrokerProviderAssetOrphanInsert) => {
    onSubmit(data);
    form.reset();
  };

  const {
    handleSubmit,
    formState: { errors },
  } = form;

  console.log("errors", errors);

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
  const form = useFormContext<BrokerProviderAssetOrphanInsert>();

  const {
    formState: { isSubmitting },
  } = form;

  const { data: brokerProviders, isLoading: isLoadingBrokerProviders } =
    useBrokerProviders();

  const selectedProviderId = form.watch("providerId");
  const selectedProvider = brokerProviders?.find(
    (p) => p.id === selectedProviderId
  );

  const nameFieldState = form.getFieldState("name");
  const providerFieldState = form.getFieldState("providerId");
  const accountTypeFieldState = form.getFieldState("accountType");

  console.log("nameFieldState", nameFieldState);
  console.log("providerFieldState", providerFieldState);
  console.log("accountTypeFieldState", accountTypeFieldState);

  const canNext =
    !nameFieldState.invalid &&
    !providerFieldState.invalid &&
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
        name="providerId"
        rules={{
          required: true,
          validate: (value) => {
            if (!value) {
              return "Provider is required";
            } else if (!brokerProviders?.find((p) => p.id === value)) {
              return "Provider is invalid";
            }
            return true;
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Select Provider</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              disabled={isLoadingBrokerProviders}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {brokerProviders?.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
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
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              disabled={!selectedProvider}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {selectedProvider &&
                  selectedProvider.supportedAccountTypes.map((type) => (
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

      <section>
        <ActionsBar {...actionsBarProps} isProcessing={isSubmitting} />
      </section>
    </>
  );
};

const AccountCreateTwo: React.FC<AccountCreateFormProps> = (props) => {
  const form = useFormContext<BrokerProviderAssetOrphanInsert>();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "securities",
  });

  const [addingSecurity, setAddingSecurity] = useState<boolean>(false);

  const {
    formState: { isSubmitting },
  } = form;

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h2 className="text-lg font-bold">Add Securities</h2>
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
            onAdd={(security) => {
              setAddingSecurity(false);
              append(security);
            }}
          />
        ) : (
          <Button onClick={() => setAddingSecurity(true)}>Add Security</Button>
        )}
        <ActionsBar {...props} isProcessing={isSubmitting} />
      </div>
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

const SecurityAddForm = ({
  onAdd,
}: {
  onAdd: (value: BrokerProviderInsertSecurityItem) => void;
}) => {
  const form = useForm<Partial<BrokerProviderInsertSecurityItem>>({
    //We need this as the form library does not use react-hook form effectively to allow valueAsNumber to work
    //And we really need a float anyway

    defaultValues: {
      security: undefined,
      shareHolding: 0,
      gainLoss: 0,
    },
  });

  const {
    control,
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
        name="gainLoss"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Gain/Loss</FormLabel>
            <FormControl>
              <Input type="number" placeholder="Gain/Loss" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button
        onClick={() => {
          if (selectedSecurity) {
            onAdd({
              tempId: crypto.randomUUID(),
              security: selectedSecurity,
              shareHolding: form.getValues("shareHolding") || 0,
              gainLoss: form.getValues("gainLoss") || 0,
            } as BrokerProviderInsertSecurityItem);
            setSelectedSecurity(null);
            setSearchInput("");
            form.reset();
          }
        }}
        disabled={!selectedSecurity}
      >
        Add
      </Button>
    </>
  );
};

type SecurityCardProps = {
  security: BrokerProviderInsertSecurityItem & { id: string };
};

const SecurityCard = ({ security }: SecurityCardProps) => {
  return (
    <div className="flex flex-col gap-2 p-2 border rounded-md">
      <div className="flex flex-row gap-2 text-ellipsis">
        <span>{security.security.symbol}</span>
        <span>{security.security.name}</span>
      </div>
      <div className="flex flex-row gap-2">
        <span>Share Holdings:</span>
        <span>{security.shareHolding}</span>
      </div>
      <div className="flex flex-row gap-2">
        <span>Gain/Loss:</span>
        <span>{security.gainLoss}</span>
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
  securities: BrokerProviderInsertSecurityItem[]
) => {
  const form = useFormContext<BrokerProviderAssetOrphanInsert>();

  const { fields: securitiesFields, append } = useFieldArray<
    BrokerProviderAssetOrphanInsert,
    "contributions.securityDistribution",
    "id"
  >({
    control: form.control,
    name: "contributions.securityDistribution",
  });

  useEffect(() => {
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
  }, [securities, append]);

  return { securitiesFields };

  //return contributionSecurities;
};

const AccountCreateThree: React.FC<AccountCreateFormProps> = (props) => {
  const form = useFormContext<BrokerProviderAssetOrphanInsert>();

  const {
    watch,
    formState: { isSubmitting },
    setValue,
  } = form;

  const securities = watch("securities");

  const { securitiesFields } = useContributionSecurities(securities);

  const process = watch("contributions.process");

  console.log("securitiesFields", securitiesFields);

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <h2 className="text-lg font-bold">Contributions</h2>
      </div>
      <FormField
        control={form.control}
        name="contributions.process"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <ToggleGroup
                type="single"
                value={field.value}
                onValueChange={field.onChange}
                className="mb-4"
              >
                <ToggleGroupItem value="automatic">Auto</ToggleGroupItem>
                <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
              </ToggleGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {process === "automatic" ? (
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
          <FormField
            control={form.control}
            name="contributions.date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contribution Date</FormLabel>
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
          />

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
          <FormField
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
          />
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
      <ActionsBar {...props} isProcessing={isSubmitting} />
    </>
  );
};
