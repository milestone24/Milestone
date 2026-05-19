import { BsPiggyBank } from "react-icons/bs";
import { useMemo, useState } from "react";
import { BundledTransactionGroup } from "./BundledTransactionGroup";
import type {
  AssetTransaction,
  FlatCombinedTransactionRow,
  RecurringContributionBulkInsert,
  RecurringContributionOrphanInsert,
  SecurityTransactionSource,
  UserAsset,
  UserAssetSecuritySelect,
  UserAssetSecurityTransactionResolved,
} from "@shared/schema";
import { createDecimalValueString } from "@shared/schema";
import { useCalculatedAssetTransactions } from "@/hooks/use-calculated-asset-transactions";
import { useRecurringContributions } from "@/hooks/use-recurring-contributions";
import {
  RecurringContributionSecurityDialog,
  RecurringContributionSecurityTriggerButton,
} from "./RecurringContributionSecurityDialog";
import { RecurringContributionsList } from "./RecurringContributionsList";
import { Skeleton } from "../ui/skeleton";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import { AssetSecurityTransactionItem } from "./AssetSecurityTransactionItem";
import { Coins, Plus, Upload } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { OcrDocumentUpload } from "@/components/ocr/OcrDocumentUpload";
import { AssetOcrPendingReviewSection } from "@/components/ocr/AssetOcrPendingReviewSection";
import { useRecordTransaction } from "@/context/RecordTransactionContext";
import { AssetCashTransactionItem } from "./AssetCashTransactionItem";
import { TransactionsDialogue } from "./TransactionsDialogue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useAssetContributionCreate } from "@/hooks/use-asset-contribution-create";
import { useAssetContributionUpdate } from "@/hooks/use-asset-contribution-update";
import { useAssetContributionDelete } from "@/hooks/use-asset-contribution-delete";
import type { AssetContributionFormData } from "@shared/schema/transaction";

type CalculatedTransactionsPanelProps = {
  asset: UserAsset;
  assetId: string;
  statementPlatformKey?: string;
};

function flatRowToAssetTransaction(row: FlatCombinedTransactionRow): AssetTransaction {
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

function flatRowToSecurityResolved(
  row: FlatCombinedTransactionRow,
  securities: UserAssetSecuritySelect[],
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

export const CalculatedTransactionsPanel = ({
  asset,
  assetId,
  statementPlatformKey,
}: CalculatedTransactionsPanelProps) => {
  const { securities, isSecuritiesLoading } = useAssetSecurities();
  const { flatTransactions } = useCalculatedAssetTransactions(assetId);
  const {
    data: rows = [],
    isLoading: isFlatLoading,
    isError: isFlatError,
    error: flatError,
  } = flatTransactions;

  const addAssetContribution = useAssetContributionCreate(assetId);
  const updateAssetContribution = useAssetContributionUpdate(assetId);
  const deleteAssetContribution = useAssetContributionDelete(assetId);

  const {
    recurringContributions,
    isLoading: isRecurringLoading,
    createRecurringContribution,
    createRecurringContributionGroup,
  } = useRecurringContributions(assetId);

  const { openTransaction } = useRecordTransaction();
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [ocrUploadDialogOpen, setOcrUploadDialogOpen] = useState(false);
  const [ocrUploadKey, setOcrUploadKey] = useState(0);

  const [cashEdit, setCashEdit] = useState<
    { data: AssetTransaction | null } | undefined
  >(undefined);
  const [cashDeleteId, setCashDeleteId] = useState<string | null>(null);

  const visibleRows = useMemo(
    () => rows.filter((r) => r.transactionType === "asset" || r.transactionType === "security"),
    [rows]
  );

  type StandaloneItem = { kind: "standalone"; row: FlatCombinedTransactionRow };
  type BundleItem = {
    kind: "bundle";
    groupId: string;
    securityRow: FlatCombinedTransactionRow;
    cashRow: FlatCombinedTransactionRow;
    sortDate: Date;
  };
  type RenderItem = StandaloneItem | BundleItem;

  const renderItems = useMemo((): RenderItem[] => {
    const bundledGroupIds = new Set<string>();
    const bundleMap = new Map<string, Partial<{ security: FlatCombinedTransactionRow; cash: FlatCombinedTransactionRow }>>();

    for (const row of visibleRows) {
      if (!row.groupId) continue;
      bundledGroupIds.add(row.groupId);
      const entry = bundleMap.get(row.groupId) ?? {};
      if (row.transactionType === "security") entry.security = row;
      if (row.transactionType === "asset") entry.cash = row;
      bundleMap.set(row.groupId, entry);
    }

    const items: RenderItem[] = [];

    for (const row of visibleRows) {
      if (row.groupId && bundledGroupIds.has(row.groupId)) {
        const entry = bundleMap.get(row.groupId);
        // Emit the bundle item once (on the security leg); skip the cash leg
        if (row.transactionType === "security" && entry?.security && entry?.cash) {
          const sortDate =
            row.valueDate instanceof Date ? row.valueDate : new Date(String(row.valueDate));
          items.push({
            kind: "bundle",
            groupId: row.groupId,
            securityRow: entry.security,
            cashRow: entry.cash,
            sortDate,
          });
        }
        // If bundle is incomplete (only one leg), fall through to standalone
        if (!(entry?.security && entry?.cash)) {
          items.push({ kind: "standalone", row });
        }
      } else {
        items.push({ kind: "standalone", row });
      }
    }

    return items;
  }, [visibleRows]);

  const firstDate = useMemo(() => {
    if (!visibleRows.length) return undefined;
    return visibleRows.reduce((min: Date | undefined, item): Date => {
      const d =
        item.valueDate instanceof Date
          ? item.valueDate
          : new Date(String(item.valueDate));
      return !min || d < min ? d : min;
    }, undefined);
  }, [visibleRows]);

  const lastDate = useMemo(() => {
    if (!visibleRows.length) return undefined;
    return visibleRows.reduce((max: Date | undefined, item): Date => {
      const d =
        item.valueDate instanceof Date
          ? item.valueDate
          : new Date(String(item.valueDate));
      return !max || d > max ? d : max;
    }, undefined);
  }, [visibleRows]);

  const handleCreateRecurringSingle = async (
    data: RecurringContributionOrphanInsert,
  ) => {
    const result = await createRecurringContribution.mutateAsync(data);
    setRecurringDialogOpen(false);
    return result;
  };

  const handleCreateRecurringDistributed = async (
    data: RecurringContributionBulkInsert,
  ) => {
    const result = await createRecurringContributionGroup.mutateAsync(data);
    setRecurringDialogOpen(false);
    return result;
  };

  const handleCashDialogSubmit = async (
    data: AssetContributionFormData,
    contributionId?: string,
  ) => {
    const value =
      typeof data.value === "string"
        ? createDecimalValueString(data.value)
        : data.value;
    if (contributionId) {
      await updateAssetContribution.mutateAsync({
        contributionId,
        assetId,
        value,
        valueDate: data.valueDate,
        currencyValue: value,
      });
    } else {
      await addAssetContribution.mutateAsync({
        assetId,
        value,
        valueDate: data.valueDate,
        currencyValue: value,
      });
    }
    setCashEdit(undefined);
  };

  const isLoading = isFlatLoading || isSecuritiesLoading;

  return (
    <>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : isFlatError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load transactions.
          {flatError instanceof Error ? ` ${flatError.message}` : null}
        </div>
      ) : (
        <div>
          <AssetOcrPendingReviewSection assetId={assetId} asset={asset} />

          {visibleRows.length > 0 && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <BsPiggyBank className="h-5 w-5 mr-2 text-txn" />
                Transaction summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-sm text-muted-foreground">Count</p>
                  <p className="text-xl font-semibold">{visibleRows.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">First</p>
                  <p className="text-base font-medium">
                    {firstDate
                      ? firstDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latest</p>
                  <p className="text-base font-medium">
                    {lastDate
                      ? lastDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOcrUploadDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Add from upload
            </Button>
            <RecurringContributionSecurityTriggerButton
              onClick={() => setRecurringDialogOpen(true)}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => openTransaction(assetId)}
            >
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          </div>

          <RecurringContributionsList
            contributions={recurringContributions}
            assetId={assetId}
            isLoading={isRecurringLoading}
          />

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Transaction history
            </h3>
            {renderItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No transactions recorded for this account.
              </div>
            )}
            {renderItems.map((item) => {
              if (item.kind === "bundle") {
                return (
                  <BundledTransactionGroup
                    key={item.groupId}
                    groupId={item.groupId}
                    securityRow={item.securityRow}
                    cashRow={item.cashRow}
                    securities={securities}
                    assetId={assetId}
                  />
                );
              }

              const { row } = item;

              if (row.transactionType === "asset") {
                const at = flatRowToAssetTransaction(row);
                return (
                  <AssetCashTransactionItem
                    key={row.id}
                    transaction={at}
                    onEdit={() => setCashEdit({ data: at })}
                    onDelete={() => setCashDeleteId(at.id)}
                  />
                );
              }

              if (row.transactionType === "security" && row.assetSecurityId) {
                return (
                  <AssetSecurityTransactionItem
                    key={row.id}
                    transaction={flatRowToSecurityResolved(row, securities)}
                    securities={securities}
                  />
                );
              }

              return null;
            })}
          </div>
        </div>
      )}

      <RecurringContributionSecurityDialog
        isOpen={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
        onSubmitSingle={handleCreateRecurringSingle}
        onSubmitDistributed={handleCreateRecurringDistributed}
        securities={securities}
        data={null}
      />

      <TransactionsDialogue
        isOpen={cashEdit !== undefined}
        onOpenChange={(open) => {
          if (!open) setCashEdit(undefined);
        }}
        onSubmit={handleCashDialogSubmit}
        data={cashEdit?.data ?? null}
      />

      <AlertDialog
        open={!!cashDeleteId}
        onOpenChange={() => setCashDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cash movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the record from your account. Values and charts may
              take a moment to refresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (cashDeleteId) {
                  await deleteAssetContribution.mutateAsync({
                    contributionId: cashDeleteId,
                  });
                  setCashDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={ocrUploadDialogOpen} onOpenChange={setOcrUploadDialogOpen}>
        <DialogContent className="max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import from statement</DialogTitle>
            <DialogDescription>
              Upload a PDF or image. When processing finishes, ready reviews appear at the top of
              this tab — open one to confirm or reject extracted contributions.
            </DialogDescription>
          </DialogHeader>
          <OcrDocumentUpload
            key={ocrUploadKey}
            nominatedAssetId={assetId}
            initialPlatformKey={statementPlatformKey}
            showPlatformSelect={false}
            awaitResultsInline={false}
            onUploadStarted={() => {
              setOcrUploadDialogOpen(false);
              setOcrUploadKey((k) => k + 1);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
