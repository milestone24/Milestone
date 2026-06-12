import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRecordTransaction } from "@milestone/js-common/react/context/RecordTransactionContext";
import { useAssets } from "@milestone/js-common/react/hooks/use-assets";
import { useBrokerPlatforms } from "@milestone/js-common/react/hooks/use-broker-platforms";
import { useAssetContributionCreate } from "@milestone/js-common/react/hooks/use-asset-contribution-create";
import {
  createDecimalValueString,
  type UserAssetWithValueChange,
} from "@milestone/js-common/schema";
import type { AssetContributionFormData } from "@milestone/js-common/schema/transaction";
import {
  getAccountTypeFullName,
  getPlatformName,
} from "@milestone/js-common/utils/platform";
import { AppModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionSingleForm } from "@/components/account/TransactionSingleForm";

function AssetPickerStep({
  assets,
  platformName,
  onSelect,
  onClose,
}: {
  assets: UserAssetWithValueChange[];
  platformName: (asset: UserAssetWithValueChange) => string;
  onSelect: (assetId: string) => void;
  onClose: () => void;
}) {
  return (
    <View className="gap-3">
      {assets.length === 0 ? (
        <Text className="text-sm text-muted-foreground py-4">
          No accounts yet. Add an account from the portfolio screen first.
        </Text>
      ) : (
        assets.map((asset) => {
          const name = platformName(asset);
          return (
            <Pressable
              key={asset.id}
              className="flex-row items-center gap-3 rounded-md border border-border p-3 active:bg-muted/50"
              onPress={() => onSelect(asset.id)}
            >
              <View className="w-10 h-10 rounded-md bg-muted items-center justify-center">
                <Text className="text-xs font-semibold text-foreground">
                  {name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-medium text-sm text-foreground">{name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {getAccountTypeFullName(asset.accountType)}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
      <View className="flex-row justify-end pt-2">
        <Button variant="outline" label="Cancel" onPress={onClose} />
      </View>
    </View>
  );
}

function ManualContributionStep({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const addAssetContribution = useAssetContributionCreate(assetId);

  const handleSubmit = async (data: AssetContributionFormData) => {
    const value =
      typeof data.value === "string" ? createDecimalValueString(data.value) : data.value;
    await addAssetContribution.mutateAsync({
      assetId,
      value,
      valueDate: data.valueDate,
      currencyValue: value,
    });
    onClose();
  };

  return (
    <TransactionSingleForm onSubmit={handleSubmit} onCancel={onClose} />
  );
}

function CalculatedTransactionStep({ onClose }: { onClose: () => void }) {
  return (
    <View className="gap-4 py-2">
      <Text className="text-sm text-muted-foreground">
        Calculated accounts support cash top-ups, investment trades, dividends, and more on the
        web client. Native support for calculated transactions is coming soon.
      </Text>
      <Button variant="outline" label="Close" onPress={onClose} />
    </View>
  );
}

export function RecordTransactionModal() {
  const { open, assetId: contextAssetId, closeTransaction } = useRecordTransaction();
  const [pickedAssetId, setPickedAssetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setPickedAssetId(undefined);
    }
  }, [open]);

  const { data: assets = [] } = useAssets();
  const { data: brokerPlatforms = [] } = useBrokerPlatforms();

  const effectiveAssetId = contextAssetId ?? pickedAssetId;
  const resolvedAsset = assets.find((asset) => asset.id === effectiveAssetId);

  const getAssetPlatformName = (asset: UserAssetWithValueChange) =>
    asset.platformId ? getPlatformName(asset.platformId, brokerPlatforms) : asset.name;

  let title = "Record transaction";
  let description = "Select the account you want to record a transaction for.";
  let content: React.ReactNode = null;

  if (!effectiveAssetId) {
    content = (
      <AssetPickerStep
        assets={assets}
        platformName={getAssetPlatformName}
        onSelect={setPickedAssetId}
        onClose={closeTransaction}
      />
    );
  } else if (!resolvedAsset) {
    content = <Skeleton className="h-48 w-full" />;
  } else if (resolvedAsset.valueMethod === "calculated") {
    title = "Add transaction";
    description = "Calculated account";
    content = <CalculatedTransactionStep onClose={closeTransaction} />;
  } else {
    title = "Add transaction";
    description = "Record a new transaction to this account.";
    content = <ManualContributionStep assetId={effectiveAssetId} onClose={closeTransaction} />;
  }

  return (
    <AppModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeTransaction();
      }}
      title={title}
      description={description}
      showCloseButton={false}
    >
      {content}
    </AppModal>
  );
}
