import {
  RecurringContributionGroupInsert,
  RecurringContributionOrphanInsert,
  UserAssetOrphanInsert,
  AssetSecurityLike,
  createDecimalValueString,
} from "@shared/schema";
import { useFieldArray, useFormContext } from "react-hook-form";
//import { useLens } from "@hookform/lenses";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { RRuleScheduler } from "../schedule/RRuleScheduler";
import { useCallback, useEffect, useState } from "react";
import { Switch } from "../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import Decimal from "decimal.js";

/**
 * If it is a asset create form (Group) then we will be either
 * 1) Adding a schedule for a manual asset contribution, (no securities)
 * 2) Adding a schedule for a calculated asset contribution, with securities
 *
 * Else we the form will be for:
 * 1) A single manual "asset" contribution (no securities)
 * 2) A single "security" contribution (with a security association)
 */

type B =
  | {
      contributions: RecurringContributionGroupInsert;
    }
  | RecurringContributionGroupInsert
  | RecurringContributionOrphanInsert;

// type B = {
//   contributions: RecurringContributionGroupInsert;
// };

const isNestedContributions = (
  data: B
): data is { contributions: RecurringContributionGroupInsert } => {
  return "contributions" in data;
};

export type RecurringContributionFormProps =
  | {
      type: "security";
      securities: AssetSecurityLike[];
    }
  | {
      type: "asset";
      securities?: undefined;
    };

export const RecurringContributionForm = <T extends B = B>({
  type,
  securities,
}: RecurringContributionFormProps) => {
  const form = useFormContext<B>();

  const {
    control,
    watch,
    formState: { isSubmitting },
    setValue,
  } = form;

  /**
   * An Attempt to use lenses to accurately use
   * variations of the parent form structure
   * Defferred until this form is used in upserts
   */
  // const l = useLens({ control });
  // const lens = isNestedContributions(data)
  //   ? l.reflect((v) => v.contributions)
  //   : l;
  // // const lens = l.reflect((v) => v.contributions);
  // const l2 = l.focus("");
  // // const {} = l2;

  const process = watch("contributions.process");

  const handleSchedulePatternChange = useCallback(
    (value: string) => {
      setValue("contributions.patternConfig", {
        type: "rrule",
        expression: value,
      });
    },
    [setValue]
  );

  useEffect(() => {
    setValue("contributions.type", type);
  }, [type]);

  const schedulePattern = watch("contributions.patternConfig");

  return (
    <>
      <FormField
        control={form.control}
        name="contributions.amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contribution Amount</FormLabel>
            <FormDescription>
              How much do you invest at the scheduled time?
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

      <RRuleScheduler
        value={schedulePattern?.expression}
        onChange={handleSchedulePatternChange}
      />

      {type === "security" ? <GroupSecurities securities={securities} /> : null}

      <div className="flex flex-col gap-3 items-start">
        <FormField
          control={form.control}
          name="contributions.process"
          render={({ field }) => (
            <FormItem className="items-start justify-start">
              <FormLabel>
                Would you like use to add your contributions automatically?
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
      {process !== "automatic" ? (
        <div className="flex flex-row gap-2 items-center">
          <p>We'll remind you to manually add your contributions.</p>
        </div>
      ) : null}
      <Notifications />
    </>
  );
};

/**
 * A security here could be one that is not yet persisted as an asset security yet.
 * Or if we are editing an existing asset security, it could be one that is already persisted as an asset security
 */

type UseContributionSecuritiesProps<T extends AssetSecurityLike> = {
  securities: T[];
};

const useContributionSecurities = <T extends AssetSecurityLike>({
  securities,
}: UseContributionSecuritiesProps<T>) => {
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
          id: security.id,
          securityName: security.security.name,
          isTempSecurityId: security.isTempSecurityId,
          commitment: createDecimalValueString("0"),
        }))
        .forEach((security) => {
          if (
            securitiesFields.find((field) => field.securityId === security.id)
          ) {
            return;
          }

          append({
            securityId: security.id,
            isTempSecurityId: security.isTempSecurityId ?? false,
            securityName: security.securityName,
            commitment:
              typeof security.commitment === "string"
                ? createDecimalValueString(security.commitment)
                : typeof security.commitment === "number"
                ? createDecimalValueString(
                    Decimal(security.commitment).toString()
                  )
                : security.commitment || createDecimalValueString("0"),
          });
        });
    }
  }, [securities, append]);

  return { securitiesFields };
};

type GroupSecuritiesProps<T extends AssetSecurityLike> = {
  securities: T[];
};

const GroupSecurities = <T extends AssetSecurityLike>({
  securities,
}: GroupSecuritiesProps<T>) => {
  const form = useFormContext<UserAssetOrphanInsert>();

  const { securitiesFields } = useContributionSecurities<T>({ securities });

  return (
    <>
      {securitiesFields.length > 0 ? (
        <FormItem>
          <FormLabel>Security Distribution</FormLabel>
          <FormDescription>
            How is the money distributed between the securities?
            <br />
            We will automatically record a contribution for each security based
            on day stock prices but you may need to correct the stock price for
            a given day.
          </FormDescription>

          {securitiesFields.length > 1 ? (
            <>
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
            </>
          ) : (
            <div className="flex flex-row gap-2 items-center">
              <p>
                You have only one security in this account so that will receive
                100% of the recurring contribution.
              </p>
              <div className="flex flex-row gap-2 items-center">
                <span className="text-sm flex-1">
                  {securitiesFields[0]?.securityName}
                </span>
              </div>
            </div>
          )}
        </FormItem>
      ) : null}
    </>
  );
};

const Notifications = () => {
  const form = useFormContext<UserAssetOrphanInsert>();

  return (
    <>
      <FormField
        control={form.control}
        name="contributions.notificationEmail"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email Notifications</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
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
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
};
