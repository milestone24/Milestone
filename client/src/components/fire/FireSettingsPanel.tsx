import { FormProvider, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FireSettingsForm } from "@/components/fire/FireSettingsForm";
import type { FireSettingsInsert } from "@shared/schema";

type FireSettingsPanelProps = {
  form: UseFormReturn<FireSettingsInsert>;
  onSubmit: ReturnType<UseFormReturn<FireSettingsInsert>["handleSubmit"]>;
  isSubmitting: boolean;
};

export function FireSettingsPanel({ form, onSubmit, isSubmitting }: FireSettingsPanelProps) {
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FireSettingsForm />
        <Button
          type="submit"
          className="w-full bg-primary text-white py-2 rounded-lg font-medium"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </FormProvider>
  );
}

