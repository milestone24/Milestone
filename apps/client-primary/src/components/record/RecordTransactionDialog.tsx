import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecordTransaction } from "@/context/RecordTransactionContext";
import { useAssets } from "@/hooks/use-assets";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { useAssetContributionCreate } from "@/hooks/use-asset-contribution-create";
import { AddCalculatedTransactionContent } from "@/components/account/AddCalculatedTransactionContent";
import { TransactionSingleForm } from "@/components/account/TransactionSingleForm";
import {
  getAccountTypeFullName,
  getPlatformName,
  getPlatformSlugFromName,
} from "@/lib/platform";
import { apiRequest } from "@/lib/queryClient";
import { assetSecurities } from "@milestone/js-common/api/queryKeys";
import {
  resolvedAssetSecuritiesSchema,
  ResolvedAssetSecurity,
} from "@milestone/js-common/schema/portfolio-assets";
import {
  AssetContributionFormData,
  createDecimalValueString,
  UserAssetWithValueChange,
} from "@milestone/js-common/schema";
import BrokerLogoBoxed from "@/components/logo/BrokerLogoBoxed";

function AssetPickerStep({
  assets,
  platformName: getPlatform,
  onSelect,
  onClose,
}: {
  assets: UserAssetWithValueChange[];
  platformName: (asset: UserAssetWithValueChange) => string;
  onSelect: (assetId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Record transaction</DialogTitle>
        <DialogDescription>
          Select the account you want to record a transaction for.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 py-2">
        {assets.map((asset) => {
          const name = getPlatform(asset);
          return (
            <button
              key={asset.id}
              type="button"
              className="flex items-center gap-3 rounded-md border p-3 text-left hover:bg-muted transition-colors"
              onClick={() => onSelect(asset.id)}
            >
              <BrokerLogoBoxed
                broker={getPlatformSlugFromName(name)}
                size="sm"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm truncate">{name}</span>
                <span className="text-xs text-muted-foreground">
                  {getAccountTypeFullName(asset.accountType)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
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
      typeof data.value === "string"
        ? createDecimalValueString(data.value)
        : data.value;
    await addAssetContribution.mutateAsync({
      assetId,
      value,
      valueDate: data.valueDate,
      currencyValue: value,
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add transaction</DialogTitle>
        <DialogDescription>
          Record a new transaction to this account.
        </DialogDescription>
      </DialogHeader>
      <TransactionSingleForm onSubmit={handleSubmit} onCancel={onClose} />
    </>
  );
}

function CalculatedTransactionStep({
  assetId,
  onClose,
  open,
}: {
  assetId: string;
  onClose: () => void;
  open: boolean;
}) {
  const { data: securities = [], isLoading } = useQuery<ResolvedAssetSecurity[]>({
    queryKey: [...assetSecurities, assetId],
    queryFn: async () => {
      const response = await apiRequest<ResolvedAssetSecurity[]>(
        "GET",
        `/api/assets/${assetId}/securities`
      );
      const validation = resolvedAssetSecuritiesSchema.safeParse(response);
      if (!validation.success) throw new Error(validation.error.message);
      return validation.data;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <AddCalculatedTransactionContent
      assetId={assetId}
      securities={securities}
      onClose={onClose}
      open={open}
    />
  );
}

export function RecordTransactionDialog() {
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
  const resolvedAsset = assets.find((a) => a.id === effectiveAssetId);

  const getAssetPlatformName = (asset: UserAssetWithValueChange) =>
    asset.platformId
      ? getPlatformName(asset.platformId, brokerPlatforms)
      : asset.name;

  const renderContent = () => {
    if (!effectiveAssetId) {
      return (
        <AssetPickerStep
          assets={assets}
          platformName={getAssetPlatformName}
          onSelect={setPickedAssetId}
          onClose={closeTransaction}
        />
      );
    }

    if (!resolvedAsset) {
      return <Skeleton className="h-48 w-full" />;
    }

    if (resolvedAsset.valueMethod === "calculated") {
      return (
        <CalculatedTransactionStep
          assetId={effectiveAssetId}
          onClose={closeTransaction}
          open={open}
        />
      );
    }

    return (
      <ManualContributionStep
        assetId={effectiveAssetId}
        onClose={closeTransaction}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeTransaction()}>
      <DialogContent className="max-w-md max-h-[min(90vh,720px)] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
