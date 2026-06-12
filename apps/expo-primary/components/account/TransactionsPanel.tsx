import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@milestone/js-common/api/transport";
import { useRecordTransaction } from "@milestone/js-common/react/context/RecordTransactionContext";
import { useAssetContributionDelete } from "@milestone/js-common/react/hooks/use-asset-contribution-delete";
import {
  assetTransactionSelectSchema,
  type AssetTransaction,
} from "@milestone/js-common/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppModal } from "@/components/ui/modal";

type TransactionsPanelProps = {
  assetId: string;
};

export function TransactionsPanel({ assetId }: TransactionsPanelProps) {
  const { openTransaction } = useRecordTransaction();
  const deleteAssetContribution = useAssetContributionDelete(assetId);
  const [contributionToDelete, setContributionToDelete] = useState<string | null>(null);

  const { data: contributions = [], isLoading } = useQuery<AssetTransaction[]>({
    queryKey: ["asset", assetId, "contributions"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/assets/${assetId}/contributions`);
      const result = assetTransactionSelectSchema.array().safeParse(response);
      if (!result.success) {
        throw new Error("Invalid contributions result");
      }
      return result.data;
    },
  });

  const handleDeleteContribution = async (contributionId: string) => {
    await deleteAssetContribution.mutateAsync({ contributionId });
    setContributionToDelete(null);
  };

  const totalContributed = contributions.reduce((sum, item) => sum + Number(item.value), 0);

  return (
    <View>
      {contributions.length > 0 ? (
        <View className="mb-4 p-4 bg-muted rounded-lg gap-3">
          <Text className="text-lg font-medium text-foreground">Contribution Summary</Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-sm text-muted-foreground">Total Contributed</Text>
              <Text className="text-xl font-semibold text-foreground">
                £{totalContributed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm text-muted-foreground">Contributions</Text>
              <Text className="text-xl font-semibold text-foreground">{contributions.length}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-lg font-medium text-foreground">Contributions</Text>
        <Button size="sm" label="Add" onPress={() => openTransaction(assetId)} />
      </View>

      {isLoading ? (
        <View className="gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </View>
      ) : contributions.length === 0 ? (
        <Text className="text-sm text-muted-foreground py-6 text-center">
          No transactions recorded yet.
        </Text>
      ) : (
        <View className="rounded-lg border border-border overflow-hidden">
          {contributions.map((contribution) => (
            <View
              key={contribution.id}
              className="flex-row items-center justify-between px-4 py-3 border-b border-border"
            >
              <View>
                <Text className="font-medium text-foreground">
                  £{Number(contribution.value).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(contribution.valueDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <Pressable onPress={() => setContributionToDelete(contribution.id)}>
                <Text className="text-sm text-destructive">Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <AppModal
        open={contributionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setContributionToDelete(null);
        }}
        title="Delete transaction"
        description="This will permanently delete this transaction."
        showCloseButton={false}
        scrollable={false}
      >
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" label="Cancel" onPress={() => setContributionToDelete(null)} />
          <Button
            variant="destructive"
            label="Delete"
            onPress={() => {
              if (contributionToDelete) {
                void handleDeleteContribution(contributionToDelete);
              }
            }}
          />
        </View>
      </AppModal>
    </View>
  );
}
