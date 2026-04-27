import { BsPiggyBank } from "react-icons/bs";
import { useMemo, useState } from "react";
import type {
  AssetTransaction,
  FlatCombinedTransactionRow,
  RecurringContributionBulkInsert,
  RecurringContributionOrphanInsert,
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
import { Coins, Pencil, Plus, Trash2, Upload } from "lucide-react";
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
import { AddCalculatedTransactionDialog } from "./AddCalculatedTransactionDialog";
import { TransactionSourceBadges } from "./TransactionSourceBadges";
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
    source: row.source ?? "manual",
    flags: row.flags ?? null,
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
  const { data: rows = [], isLoading: isFlatLoading } = flatTransactions;

  const addAssetContribution = useAssetContributionCreate(assetId);
  const updateAssetContribution = useAssetContributionUpdate(assetId);
  const deleteAssetContribution = useAssetContributionDelete(assetId);

  const {
    recurringContributions,
    isLoading: isRecurringLoading,
    createRecurringContribution,
    createRecurringContributionGroup,
  } = useRecurringContributions(assetId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
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
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          </div>

          <AddCalculatedTransactionDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            assetId={assetId}
            securities={securities}
          />

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
            {visibleRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No transactions recorded for this account.
              </div>
            )}
            {visibleRows.map((row) => {
              if (row.transactionType === "asset") {
                const at = flatRowToAssetTransaction(row);
                return (
                  <div
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-muted rounded-lg"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <Coins className="h-4 w-4 text-txn" />
                        <span className="text-sm text-muted-foreground">
                          Cash movement
                        </span>
                        <span className="font-semibold">
                          £{Number(at.currencyValue).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                        <TransactionSourceBadges
                          source={at.source}
                          flags={at.flags}
                        />
                        <span>
                          {new Date(at.valueDate).toLocaleDateString("en-GB", {
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
                        onClick={() => setCashEdit({ data: at })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setCashDeleteId(at.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
