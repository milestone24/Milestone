import { useState, useCallback } from "react";
import type {
  AssetContributionFormData,
  AssetTransaction,
  FlatCombinedTransactionRow,
  UserAssetSecuritySelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { createDecimalValueString } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronRight, Coins, Layers2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionSourceBadges } from "./TransactionSourceBadges";
import { AssetSecurityTransactionItem } from "./AssetSecurityTransactionItem";
import { TransactionsDialogue } from "./TransactionsDialogue";
import { useTransactionBundle } from "@/hooks/use-transaction-bundle";
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
  groupId,
  securityRow,
  cashRow,
  securities,
  assetId,
}: BundledTransactionGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const [bundleDeleteOpen, setBundleDeleteOpen] = useState(false);
  const [cashEdit, setCashEdit] = useState<{ data: AssetTransaction | null } | undefined>(
    undefined
  );
  const [cashDeleteOpen, setCashDeleteOpen] = useState(false);

  const { deleteBundle } = useTransactionBundle(assetId);
  const updateCashLeg = useAssetContributionUpdate(assetId);
  const deleteCashLeg = useAssetContributionDelete(assetId);

  const securityResolved = toSecurityResolved(securityRow, securities);
  const cashTransaction = toCashTransaction(cashRow);

  const direction = Number(securityRow.value) > 0 ? "Buy" : "Sell";
  const valueDate =
    securityRow.valueDate instanceof Date
      ? securityRow.valueDate
      : new Date(String(securityRow.valueDate));

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
      <div className="rounded-lg border bg-muted overflow-hidden">
        {/* Header / collapsed row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
          <button
            type="button"
            className="flex flex-1 items-start sm:items-center gap-2 min-w-0 text-left"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <Layers2 className="h-4 w-4 mt-0.5 shrink-0 text-txn" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-sm text-muted-foreground">
                  {securityResolved.securityName}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-1.5 py-0",
                    direction === "Buy"
                      ? "text-positive border-positive"
                      : "text-negative border-negative"
                  )}
                >
                  {direction}
                </Badge>
                <span
                  className={cn(
                    "font-semibold text-sm",
                    Number(securityRow.value) > 0 ? "text-positive" : "text-negative"
                  )}
                >
                  {Number(securityRow.value) > 0 ? "+" : ""}
                  {Number(securityRow.value)} shares
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                <TransactionSourceBadges
                  source={securityRow.source ?? "manual"}
                  flags={securityRow.flags ?? null}
                />
                <span>
                  {valueDate.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {" · "}£{Number(securityRow.currencyValue).toLocaleString()}
                </span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  2 legs
                </Badge>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setBundleDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded legs */}
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-3">
            {/* Security leg */}
            <div className="rounded-md border bg-background p-1">
              <AssetSecurityTransactionItem
                transaction={securityResolved}
                securities={securities}
              />
            </div>

            {/* Cash leg */}
            <div className="rounded-md border bg-background p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  <Coins className="h-4 w-4 text-txn" />
                  <span className="text-sm text-muted-foreground">Cash movement</span>
                  <span className="font-semibold">
                    £{Number(cashTransaction.currencyValue).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                  <TransactionSourceBadges
                    source={cashTransaction.source}
                    flags={cashTransaction.flags}
                  />
                  <span>
                    {new Date(cashTransaction.valueDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCashEdit({ data: cashTransaction })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setCashDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bundle delete confirm */}
      <AlertDialog open={bundleDeleteOpen} onOpenChange={setBundleDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trade and cash movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes both the security trade and the linked cash movement from your account.
              Values and charts may take a moment to refresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteBundle.mutate(groupId)}>
              Delete both
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              This removes only the cash leg. The security trade will remain as a standalone record.
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
