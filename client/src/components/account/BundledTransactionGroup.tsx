import { useState, useCallback } from "react";
import type {
  AssetContributionFormData,
  AssetTransaction,
  FlatCombinedTransactionRow,
  SecurityTransactionSource,
  UserAssetSecuritySelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { createDecimalValueString } from "@shared/schema";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssetSecurityTransactionItem } from "./AssetSecurityTransactionItem";
import { AssetCashTransactionItem } from "./AssetCashTransactionItem";
import { TransactionsDialogue } from "./TransactionsDialogue";
import { Button } from "@/components/ui/button";
import { useAssetContributionUpdate } from "@/hooks/use-asset-contribution-update";
import { useAssetContributionDelete } from "@/hooks/use-asset-contribution-delete";
import { useTransactionBundle } from "@/hooks/use-transaction-bundle";

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
    source: (row.source ?? "manual") as SecurityTransactionSource,
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
  groupId,
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
  const { deleteBundle } = useTransactionBundle(assetId);

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

      {/* Cash leg delete confirm */}
      <Dialog open={cashDeleteOpen} onOpenChange={setCashDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete cash movement?</DialogTitle>
            <DialogDescription>
              This cash movement is linked to a trade. Choose what to delete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => deleteCashLeg.mutate({ contributionId: cashTransaction.id })}
              >
                Delete cash only
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                variant="destructive"
                onClick={() => deleteBundle.mutate(groupId)}
              >
                Delete cash and trade
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
