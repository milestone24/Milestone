import { useState, useCallback } from "react";
import type {
  AssetContributionFormData,
  AssetTransaction,
  FlatCombinedTransactionRow,
  UserAssetSecuritySelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { createDecimalValueString } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssetSecurityTransactionItem } from "./AssetSecurityTransactionItem";
import { AssetCashTransactionItem } from "./AssetCashTransactionItem";
import { TransactionsDialogue } from "./TransactionsDialogue";
import { useAssetContributionUpdate } from "@/hooks/use-asset-contribution-update";
import { useAssetContributionDelete } from "@/hooks/use-asset-contribution-delete";

type BundledTransactionGroupProps = {
  groupId: string;
  securityRow: FlatCombinedTransactionRow;
  cashRow: FlatCombinedTransactionRow;
  securities: UserAssetSecuritySelect[];
  assetId: string;
};

function toSecurityResolved(
  row: FlatCombinedTransactionRow,
  securities: UserAssetSecuritySelect[]
): UserAssetSecurityTransactionResolved {
  const holding = securities.find((s) => s.id === row.assetSecurityId);
  return {
    id: row.id,
    assetSecurityId: row.assetSecurityId!,
    value: row.value,
    currencyValue: row.currencyValue,
    fees: row.fees ?? null,
    currency: row.currency,
    valueDate: row.valueDate,
    recordedAt: row.recordedAt,
    source: row.source ?? "manual",
    flags: row.flags ?? null,
    ledgerGroupId: row.groupId ?? null,
    createdAt: row.createdAt ?? row.recordedAt,
    updatedAt: row.updatedAt ?? row.recordedAt,
    securityName: holding?.security.name ?? "Security",
  };
}

function toCashTransaction(row: FlatCombinedTransactionRow): AssetTransaction {
  return {
    id: row.id,
    assetId: row.assetId,
    value: row.value,
    currencyValue: row.currencyValue,
    fees: row.fees ?? createDecimalValueString("0"),
    currency: row.currency,
    valueDate: row.valueDate,
    recordedAt: row.recordedAt,
    source: row.source ?? "manual",
    flags: row.flags ?? null,
    ledgerGroupId: row.groupId ?? null,
    createdAt: row.createdAt ?? row.recordedAt,
    updatedAt: row.updatedAt ?? row.recordedAt,
  };
}

export function BundledTransactionGroup({
  securityRow,
  cashRow,
  securities,
  assetId,
}: BundledTransactionGroupProps) {
  const [cashEdit, setCashEdit] = useState<{ data: AssetTransaction | null } | undefined>(
    undefined
  );
  const [cashDeleteOpen, setCashDeleteOpen] = useState(false);

  const updateCashLeg = useAssetContributionUpdate(assetId);
  const deleteCashLeg = useAssetContributionDelete(assetId);

  const securityResolved = toSecurityResolved(securityRow, securities);
  const cashTransaction = toCashTransaction(cashRow);

  const handleCashEdit = useCallback(
    async (data: AssetContributionFormData, contributionId?: string) => {
      if (!contributionId) return;
      const value =
        typeof data.value === "string" ? createDecimalValueString(data.value) : data.value;
      await updateCashLeg.mutateAsync({
        contributionId,
        assetId,
        value,
        valueDate: data.valueDate,
        currencyValue: value,
      });
      setCashEdit(undefined);
    },
    [updateCashLeg, assetId]
  );

  return (
    <>
      <div className="rounded-lg overflow-hidden border divide-y [&>*:first-child]:!rounded-b-none [&>*:last-child]:!rounded-t-none">
        {/* Security leg */}
        <AssetSecurityTransactionItem
          transaction={securityResolved}
          securities={securities}
        />

        {/* Cash leg */}
        <AssetCashTransactionItem
          transaction={cashTransaction}
          onEdit={() => setCashEdit({ data: cashTransaction })}
          onDelete={() => setCashDeleteOpen(true)}
        />
      </div>

      {/* Cash leg edit */}
      <TransactionsDialogue
        isOpen={cashEdit !== undefined}
        onOpenChange={(open) => {
          if (!open) setCashEdit(undefined);
        }}
        onSubmit={(data) => handleCashEdit(data, cashEdit?.data?.id)}
        data={cashEdit?.data ?? null}
      />

      {/* Cash leg individual delete confirm */}
      <AlertDialog open={cashDeleteOpen} onOpenChange={setCashDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cash movement only?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes only the cash leg. The security trade will remain as a standalone
              record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteCashLeg.mutateAsync({ contributionId: cashTransaction.id });
                setCashDeleteOpen(false);
              }}
            >
              Delete cash movement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
