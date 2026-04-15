import { useMemo, useState } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcrAssetCandidateCard } from "./OcrAssetCandidateCard";
import { OcrBalanceReview } from "./OcrBalanceReview";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import { securityTransactionOcrRowToOrphanInsert } from "@shared/schema/transaction";
import type { ExtractedAmount, DocumentOcrPipelineResult } from "@shared/schema/document";
import type { OcrAssetCandidateResult } from "@shared/schema/transaction";
import type { UserAsset } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { assetOcrPendingReview } from "@shared/api/queryKeys";

interface OcrResultReviewProps {
  pipeline: DocumentOcrPipelineResult;
  extractedValues: ExtractedAmount[];
  assets: UserAsset[];
  /** When set, review outcome is persisted and linked transactions are recorded on accept. */
  ocrJobId?: string;
  onConfirmed: () => void;
  onDismissed: () => void;
  onBalancesSaved: (data: { assetId: string; value: number }[]) => void;
}

function invalidatePendingOcrQueries(
  pipeline: DocumentOcrPipelineResult,
  assetsList: UserAsset[]
) {
  const assetId = pipeline.nominatedUserAssetId ?? assetsList[0]?.id;
  if (assetId) {
    queryClient.invalidateQueries({
      queryKey: [...assetOcrPendingReview, assetId],
    });
  }
}

async function postOcrJobReview(
  jobId: string,
  body:
    | { outcome: "rejected" }
    | { outcome: "accepted"; securityTransactionIds: string[] }
): Promise<void> {
  await apiRequest("POST", `/api/ocr-jobs/${jobId}/review`, body);
}

function deriveInitialCandidate(
  candidates: OcrAssetCandidateResult[],
  nominatedUserAssetId: string | null
): string | null {
  const fullMatches = candidates.filter((c) => c.matchedCount === c.totalCount);

  if (nominatedUserAssetId) {
    const nominee = candidates.find((c) => c.userAssetId === nominatedUserAssetId);
    if (nominee && nominee.matchedCount === nominee.totalCount) return nominee.userAssetId;
  }

  if (fullMatches.length === 1) return fullMatches[0]!.userAssetId;

  return null;
}

export function OcrResultReview({
  pipeline,
  extractedValues,
  assets,
  ocrJobId,
  onConfirmed,
  onDismissed,
  onBalancesSaved,
}: OcrResultReviewProps) {
  const { assetCandidates, nominatedUserAssetId } = pipeline;

  const hasNominatedInCandidates =
    nominatedUserAssetId !== null &&
    assetCandidates.some((c) => c.userAssetId === nominatedUserAssetId);

  const [showAllAssetCandidates, setShowAllAssetCandidates] = useState(
    () => !hasNominatedInCandidates
  );

  const visibleAssetCandidates = useMemo(() => {
    if (showAllAssetCandidates || nominatedUserAssetId === null) {
      return assetCandidates;
    }
    return assetCandidates.filter((c) => c.userAssetId === nominatedUserAssetId);
  }, [assetCandidates, nominatedUserAssetId, showAllAssetCandidates]);

  const otherCandidateCount = assetCandidates.length - visibleAssetCandidates.length;

  const initialSelected = useMemo(
    () => deriveInitialCandidate(assetCandidates, nominatedUserAssetId),
    [assetCandidates, nominatedUserAssetId]
  );

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(initialSelected);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { addSecurityTransaction } = useSecurityTransactions(selectedCandidateId ?? "");

  const selectedCandidate =
    assetCandidates.find((c) => c.userAssetId === selectedCandidateId) ?? null;

  const hasSuspectRows = selectedCandidate?.securities.some((s) => !s.verified) ?? false;

  const finishDismissed = async () => {
    try {
      if (ocrJobId) {
        await postOcrJobReview(ocrJobId, { outcome: "rejected" });
      }
      invalidatePendingOcrQueries(pipeline, assets);
      onDismissed();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Could not save review outcome");
    }
  };

  const finalizeAccepted = async (securityTransactionIds: string[]) => {
    if (ocrJobId) {
      await postOcrJobReview(ocrJobId, {
        outcome: "accepted",
        securityTransactionIds,
      });
    }
    invalidatePendingOcrQueries(pipeline, assets);
    onConfirmed();
  };

  const handleConfirm = async () => {
    if (!selectedCandidate) return;

    const matchedRows = selectedCandidate.securities.filter(
      (s) => s.matched && s.userAssetSecurityId !== null
    );

    if (matchedRows.length === 0) {
      try {
        await finalizeAccepted([]);
      } catch (e) {
        setConfirmError(e instanceof Error ? e.message : "Could not save review outcome");
      }
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);

    try {
      const createdIds: string[] = [];
      for (const row of matchedRows) {
        const created = await addSecurityTransaction.mutateAsync({
          securityId: row.userAssetSecurityId!,
          data: securityTransactionOcrRowToOrphanInsert(row.ocrRow),
        });
        createdIds.push(created.id);
      }
      await finalizeAccepted(createdIds);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Failed to save transactions");
    } finally {
      setIsConfirming(false);
    }
  };

  if (assetCandidates.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          No portfolio holdings matched the securities in this document.
        </div>

        {pipeline.securityHoldings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Extracted rows (unmatched)
            </p>
            {pipeline.securityHoldings.map((row, i) => (
              <div key={i} className="text-sm border rounded-md px-3 py-2 text-muted-foreground">
                {row.name ?? row.symbol ?? "Unknown security"}
              </div>
            ))}
          </div>
        )}

        <OcrBalanceReview
          extractedValues={extractedValues}
          assets={assets}
          onSave={onBalancesSaved}
        />

        {confirmError && (
          <p className="text-sm text-destructive">{confirmError}</p>
        )}

        <Button variant="outline" onClick={() => void finishDismissed()} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {!showAllAssetCandidates && visibleAssetCandidates.length === 1
            ? "Review matches for this portfolio account"
            : assetCandidates.length === 1
              ? "Matched portfolio account"
              : "Select the portfolio account this statement belongs to"}
        </p>

        {visibleAssetCandidates.map((candidate) => (
          <OcrAssetCandidateCard
            key={candidate.userAssetId}
            candidate={candidate}
            selected={selectedCandidateId === candidate.userAssetId}
            onSelect={() => setSelectedCandidateId(candidate.userAssetId)}
          />
        ))}

        {otherCandidateCount > 0 && !showAllAssetCandidates ? (
          <button
            type="button"
            onClick={() => setShowAllAssetCandidates(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Show other portfolio accounts ({otherCandidateCount})
          </button>
        ) : null}
      </div>

      {hasSuspectRows && (
        <div className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          Some rows were flagged as suspect. Review them before confirming.
        </div>
      )}

      {confirmError && (
        <p className="text-sm text-destructive">{confirmError}</p>
      )}

      <OcrBalanceReview
        extractedValues={extractedValues}
        assets={assets}
        onSave={onBalancesSaved}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => void finishDismissed()}
          className="flex-1"
          disabled={isConfirming}
        >
          <X className="h-4 w-4 mr-2" />
          Dismiss
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          className="flex-1"
          disabled={!selectedCandidate || isConfirming}
        >
          <Check className="h-4 w-4 mr-2" />
          {isConfirming ? "Saving…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
