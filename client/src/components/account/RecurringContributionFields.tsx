import { useCallback } from "react";
import { useController, useWatch } from "react-hook-form";
import type { RecurringContributionFormData } from "@shared/schema/transaction";
import { createDecimalValueString } from "@shared/schema";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Switch } from "../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { RRuleScheduler } from "../schedule/RRuleScheduler";
import { dateToDateInputValue } from "@/lib/form";
import { Lens } from "@hookform/lenses";

type RecurringContributionFieldsProps = {
  lens: Lens<RecurringContributionFormData>;
  showStartDate?: boolean;
};

/**
 * Shared form fields for recurring contributions.
 * Uses @hookform/lenses for type-safe field access.
 * Used by both:
 * - TransactionRecurringForm (standalone CRUD)
 * - RecurringContributionForm (asset creation flow via lenses)
 */
export const RecurringContributionFields = ({
  lens,
  showStartDate = true,
}: RecurringContributionFieldsProps) => {
  // Get controllers for each field using lens.interop()
  const { field: amountField, fieldState: amountFieldState } = useController(
    lens.focus("amount").interop()
  );
  const { field: startDateField, fieldState: startDateFieldState } =
    useController(lens.focus("startDate").interop());
  const { field: processField, fieldState: processFieldState } = useController(
    lens.focus("process").interop()
  );
  const { field: isActiveField, fieldState: isActiveFieldState } =
    useController(lens.focus("isActive").interop());
  const { field: notificationEmailField } = useController(
    lens.focus("notificationEmail").interop()
  );
  const { field: notificationPushField } = useController(
    lens.focus("notificationPush").interop()
  );
  const { field: patternConfigField } = useController(
    lens.focus("patternConfig").interop()
  );

  const handleSchedulePatternChange = useCallback(
    (expression: string) => {
      patternConfigField.onChange({
        type: "rrule",
        expression,
      });
    },
    [patternConfigField]
  );

  return (
    <>
      {showStartDate && (
        <FormItem>
          <FormLabel>Start Date</FormLabel>
          <Input
            type="date"
            value={dateToDateInputValue(startDateField.value)}
            onChange={(e) => {
              startDateField.onChange(new Date(e.target.value));
            }}
          />
          {startDateFieldState.error && (
            <FormMessage>{startDateFieldState.error.message}</FormMessage>
          )}
        </FormItem>
      )}
      <FormItem>
        <FormLabel>Contribution Amount (£)</FormLabel>
        <FormDescription>
          How much do you invest at the scheduled time?
        </FormDescription>
        <FormControl>
          <Input
            type="number"
            placeholder="Contribution Amount"
            value={amountField.value ?? createDecimalValueString("0")}
            onChange={(e) => {
              amountField.onChange(createDecimalValueString(e.target.value));
            }}
          />
        </FormControl>
        {amountFieldState.error && (
          <FormMessage>{amountFieldState.error.message}</FormMessage>
        )}
      </FormItem>

      <div className="space-y-2">
        <FormLabel>Schedule</FormLabel>
        <FormDescription>
          Set how often this contribution should occur
        </FormDescription>
        <RRuleScheduler
          value={patternConfigField.value?.expression}
          onChange={handleSchedulePatternChange}
        />
      </div>

      <FormItem>
        <FormLabel>
          Would you like us to add your contributions automatically?
        </FormLabel>
        <FormControl>
          <ToggleGroup
            type="single"
            value={processField.value}
            onValueChange={processField.onChange}
            className="justify-start"
          >
            <ToggleGroupItem value="automatic">Yes</ToggleGroupItem>
            <ToggleGroupItem value="manual">No</ToggleGroupItem>
          </ToggleGroup>
        </FormControl>
        <FormDescription>
          {processField.value === "automatic"
            ? "Contributions will be added automatically on the scheduled dates."
            : "We'll remind you to manually add your contributions."}
        </FormDescription>
        {processFieldState.error && (
          <FormMessage>{processFieldState.error.message}</FormMessage>
        )}
      </FormItem>

      <div className="flex flex-row flex-wrap">
        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
          <FormControl>
            <Checkbox
              checked={isActiveField.value}
              onCheckedChange={isActiveField.onChange}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>Active</FormLabel>
            <p className="text-sm text-muted-foreground">
              Enable or disable this recurring contribution
            </p>
          </div>
        </FormItem>
      </div>

      <div className="flex flex-col gap-4">
        <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5">
            <FormLabel>Email Notifications</FormLabel>
            <FormDescription>
              Receive email reminders for this contribution
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={notificationEmailField.value}
              onCheckedChange={notificationEmailField.onChange}
            />
          </FormControl>
        </FormItem>
        <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5">
            <FormLabel>Push Notifications</FormLabel>
            <FormDescription>
              Receive push notifications for this contribution
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={notificationPushField.value}
              onCheckedChange={notificationPushField.onChange}
            />
          </FormControl>
        </FormItem>
      </div>
    </>
  );
};
