import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { assetUpdateSchema, ResolvedUserAsset } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Pencil, X } from "lucide-react";
import { useAssetUpdate } from "@/hooks/use-asset-update";

/**
 * Configuration for which fields are editable in the AccountDetails component.
 * Fields not included or set to false will be displayed as read-only.
 */
export type AccountDetailsEditableFields = {
  startDate?: boolean;
  valueMethod?: boolean;
  id?: boolean;
};

/**
 * Define the field keys that AccountDetails supports
 */
type AccountDetailField = "startDate" | "valueMethod" | "id";

/**
 * Field configuration for rendering
 */
type FieldConfig = {
  key: AccountDetailField;
  label: string;
  formatValue: (asset: ResolvedUserAsset) => string;
  renderInput?: (
    field: { value: unknown; onChange: (value: unknown) => void },
    asset: ResolvedUserAsset
  ) => React.ReactNode;
};

/**
 * Define all available fields and their display/edit configuration
 */
const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "startDate",
    label: "Start Date",
    formatValue: (asset) => asset.startDate.toLocaleDateString(),
    renderInput: (field) => (
      <Input
        type="date"
        value={
          field.value instanceof Date
            ? field.value.toISOString().split("T")[0]
            : ""
        }
        onChange={(e) => field.onChange(new Date(e.target.value))}
      />
    ),
  },
  {
    key: "valueMethod",
    label: "Value Method",
    formatValue: (asset) =>
      asset.valueMethod === "calculated" ? "Calculated" : "Manual",
  },
  {
    key: "id",
    label: "Asset ID",
    formatValue: (asset) => asset.id,
  },
];

type AccountDetailsFormValues = z.infer<typeof assetUpdateSchema>;

type AccountDetailsProps = {
  asset: ResolvedUserAsset;
  editableFields?: AccountDetailsEditableFields;
};

export function AccountDetails({
  asset,
  editableFields = {},
}: AccountDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { mutateAsync: updateAsset, isPending } = useAssetUpdate(asset.id);

  const hasEditableFields = Object.values(editableFields).some(Boolean);

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(assetUpdateSchema),
    defaultValues: {
      startDate: asset.startDate,
    },
  });

  const handleSubmit = async (values: AccountDetailsFormValues) => {
    await updateAsset(values);
    setIsEditing(false);
  };

  const handleCancel = () => {
    form.reset({
      startDate: asset.startDate,
    });
    setIsEditing(false);
  };

  const renderFieldValue = (config: FieldConfig) => (
    <div
      key={config.key}
      className="flex flex-row justify-between items-center py-2"
    >
      <span className="text-muted-foreground">{config.label}</span>
      <span>{config.formatValue(asset)}</span>
    </div>
  );

  const renderFieldEdit = (config: FieldConfig) => {
    const isEditable = editableFields[config.key];

    if (!isEditable || !config.renderInput) {
      // Non-editable field - render as display
      return renderFieldValue(config);
    }

    // Editable field - render as form input
    return (
      <FormField
        key={config.key}
        control={form.control}
        name={config.key as keyof AccountDetailsFormValues}
        render={({ field }) => (
          <FormItem className="flex flex-row justify-between items-center py-2">
            <FormLabel className="text-muted-foreground">
              {config.label}
            </FormLabel>
            <div className="flex flex-col items-end">
              <FormControl>{config.renderInput!(field, asset)}</FormControl>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />
    );
  };

  if (isEditing) {
    return (
      <section>
        <div className="flex flex-row justify-between items-center">
          <h2 className="text-lg font-medium my-2 md:my-4">Asset Details</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="bg-card rounded-lg px-4 divide-y divide-border/30">
              {FIELD_CONFIGS.map(renderFieldEdit)}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-row justify-between items-center">
        <h2 className="text-lg font-medium my-2 md:my-4">Asset Details</h2>
        {hasEditableFields && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="bg-card rounded-lg px-4 divide-y divide-border/30">
        {FIELD_CONFIGS.map(renderFieldValue)}
      </div>
    </section>
  );
}
