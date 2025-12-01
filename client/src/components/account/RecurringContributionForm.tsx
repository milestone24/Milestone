import {
  UserAssetOrphanInsert,
  AssetSecurityLike,
  createDecimalValueString,
} from "@shared/schema";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useLens } from "@hookform/lenses";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { useEffect } from "react";
import Decimal from "decimal.js";
import { RecurringContributionFields } from "./RecurringContributionFields";
import type { RecurringContributionFormData } from "@shared/schema/transaction";
import type { Lens } from "@hookform/lenses";

/**
 * If it is a asset create form (Group) then we will be either
 * 1) Adding a schedule for a manual asset contribution, (no securities)
 * 2) Adding a schedule for a calculated asset contribution, with securities
 *
 * Else we the form will be for:
 * 1) A single manual "asset" contribution (no securities)
 * 2) A single "security" contribution (with a security association)
 */

export type RecurringContributionFormProps =
  | {
      type: "security";
      securities: AssetSecurityLike[];
    }
  | {
      type: "asset";
      securities?: undefined;
    };

export const RecurringContributionForm = ({
  type,
  securities,
}: RecurringContributionFormProps) => {
  const form = useFormContext<UserAssetOrphanInsert>();

  const { control, setValue } = form;

  // Create lens from the parent form's control
  const lens = useLens({ control });

  // Focus on the contributions path and cast to the expected type
  // The contributions field has the same shape as RecurringContributionFormData
  // plus type and securityDistribution fields
  const contributionsLens = lens.focus("contributions") as unknown as Lens<RecurringContributionFormData>;

  // Set the type when component mounts or type changes
  useEffect(() => {
    setValue("contributions.type", type);
  }, [type, setValue]);

  // Set security distribution when there's only one security
  useEffect(() => {
    if (securities && securities.length === 1) {
      const security = securities[0]!;
      setValue("contributions.securityDistribution", [
        {
          securityId: security.id,
          securityName: security.security.name,
          isTempSecurityId: security.isTempSecurityId ?? false,
          commitment: createDecimalValueString("100"),
        },
      ]);
    }
  }, [securities, setValue]);

  return (
    <>
      <RecurringContributionFields
        lens={contributionsLens}
        showStartDate={false}
      />

      {type === "security" ? <GroupSecurities securities={securities} /> : null}
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
  }, [securities, append, securitiesFields]);

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
