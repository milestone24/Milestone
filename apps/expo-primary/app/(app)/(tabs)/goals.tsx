import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import { useMilestones } from "@milestone/js-common/react/hooks/use-milestones";
import { useMilestoneCreate } from "@milestone/js-common/react/hooks/use-milestone-create";
import { useMilestoneDelete } from "@milestone/js-common/react/hooks/use-milestone-delete";
import { useAssets } from "@milestone/js-common/react/hooks/use-assets";
import { usePortfolioOverview } from "@milestone/js-common/react/hooks/use-portfolio-overview";
import {
  type AccountType,
  type Milestone,
  createDecimalValueString,
} from "@milestone/js-common/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AppModal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

const milestoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accountType: z.string().optional(),
  targetValue: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: "Target value must be a positive number",
    }),
});

type MilestoneFormValues = z.infer<typeof milestoneSchema>;

function calculateProgress(
  milestone: Milestone,
  assets: ReturnType<typeof useAssets>["data"],
  portfolioOverview: ReturnType<typeof usePortfolioOverview>["data"]
) {
  let currentValue = 0;

  if (milestone.accountType) {
    currentValue = (assets ?? []).reduce(
      (sum, asset) =>
        asset.accountType === milestone.accountType
          ? sum + Number(asset.currentValue)
          : sum,
      0
    );
  } else {
    currentValue = portfolioOverview?.value ? Number(portfolioOverview.value) : 0;
  }

  const targetValue = Number(milestone.targetValue);
  return targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
}

export default function GoalsScreen() {
  const { milestones, isLoading } = useMilestones();
  const addMilestone = useMilestoneCreate();
  const deleteMilestone = useMilestoneDelete();
  const { data: assets = [] } = useAssets();
  const { data: portfolioOverview } = usePortfolioOverview();
  const { user } = useSession();

  const availableAccountTypes = useMemo(() => {
    const types = new Set<AccountType | "ALL">(["ALL"]);
    assets.forEach((asset) => {
      if (asset.accountType) {
        types.add(asset.accountType as AccountType);
      }
    });
    return Array.from(types);
  }, [assets]);

  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<string | null>(null);

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      name: "",
      accountType: "ALL",
      targetValue: "",
    },
  });

  const onSubmit = async (values: MilestoneFormValues) => {
    if (!user) return;

    await addMilestone.mutateAsync({
      name: values.name,
      accountType:
        values.accountType === "ALL" ? null : (values.accountType as AccountType),
      targetValue: createDecimalValueString(values.targetValue),
    });
    setIsAddMilestoneOpen(false);
    form.reset();
  };

  const handleDeleteMilestone = async () => {
    if (!milestoneToDelete) return;
    await deleteMilestone.mutateAsync(milestoneToDelete);
    setMilestoneToDelete(null);
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 pb-24">
      <Card>
        <CardContent>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-semibold text-foreground">Milestones</Text>
            <Button
              variant="ghost"
              size="sm"
              label="+ Add"
              onPress={() => setIsAddMilestoneOpen(true)}
            />
          </View>

          {isLoading ? (
            <View className="gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </View>
          ) : !milestones?.length ? (
            <Text className="text-muted-foreground text-center py-8">
              No milestones yet. Add your first goal to track progress.
            </Text>
          ) : (
            <View className="gap-3">
              {milestones.map((milestone) => {
                const progress = calculateProgress(milestone, assets, portfolioOverview);
                return (
                  <View
                    key={milestone.id}
                    className="rounded-lg border border-border p-3 bg-muted/30"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="font-medium text-foreground">{milestone.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          Target: £{Number(milestone.targetValue).toLocaleString()}
                          {milestone.accountType ? ` · ${milestone.accountType}` : " · All accounts"}
                        </Text>
                      </View>
                      <Pressable onPress={() => setMilestoneToDelete(milestone.id)}>
                        <Text className="text-destructive text-sm">Delete</Text>
                      </Pressable>
                    </View>
                    <View className="h-2 rounded-full bg-muted overflow-hidden">
                      <View
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </View>
                    <Text className="text-xs text-muted-foreground mt-1">
                      {progress.toFixed(1)}% complete
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </CardContent>
      </Card>

      <AppModal
        open={isAddMilestoneOpen}
        onOpenChange={setIsAddMilestoneOpen}
        title="Add Milestone"
        description="Create a new milestone to track your investment progress."
      >
        <View className="gap-4">
          <View>
            <Label>Milestone Name</Label>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="e.g. First £100k"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {form.formState.errors.name ? (
              <Text className="text-destructive text-xs mt-1">
                {form.formState.errors.name.message}
              </Text>
            ) : null}
          </View>

          {assets.length === 0 ? (
            <Text className="text-destructive text-sm">
              Add at least one account in Portfolio before creating milestones.
            </Text>
          ) : (
            <View>
              <Label>Account Type (optional)</Label>
              <View className="flex-row flex-wrap gap-2 mt-2">
                {availableAccountTypes.map((type) => (
                  <Pressable
                    key={type}
                    className={cn(
                      "px-3 py-1 rounded-full border",
                      form.watch("accountType") === type
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                    onPress={() => form.setValue("accountType", type)}
                  >
                    <Text
                      className={cn(
                        "text-xs",
                        form.watch("accountType") === type
                          ? "text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      {type === "ALL" ? "All accounts" : type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View>
            <Label>Target Value (£)</Label>
            <Controller
              control={form.control}
              name="targetValue"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="100000"
                  keyboardType="numeric"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {form.formState.errors.targetValue ? (
              <Text className="text-destructive text-xs mt-1">
                {form.formState.errors.targetValue.message}
              </Text>
            ) : null}
          </View>

          <Button
            label={addMilestone.isPending ? "Adding..." : "Add Milestone"}
            disabled={addMilestone.isPending || assets.length === 0}
            onPress={form.handleSubmit(onSubmit)}
          />
        </View>
      </AppModal>

      <AppModal
        open={!!milestoneToDelete}
        onOpenChange={(open) => !open && setMilestoneToDelete(null)}
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone?"
      >
        <Button
          variant="destructive"
          label="Delete"
          onPress={handleDeleteMilestone}
        />
      </AppModal>
      </View>
    </ScrollView>
  );
}
