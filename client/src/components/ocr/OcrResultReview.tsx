import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcrAssetCandidateCard } from "./OcrAssetCandidateCard";
import { OcrBalanceReview } from "./OcrBalanceReview";
import {
  OcrResultsEmptyState,
  OcrResultsPlainHoldingRows,
  OcrResultsSubjectHeading,
  OcrResultsWarningNotice,
} from "@/components/ocr/results-layout";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import { securityTransactionOcrRowToOrphanInsert } from "@shared/schema/transaction";
import type { ExtractedAmount, DocumentOcrPipelineResult } from "@shared/schema/document";
import type { OcrAssetCandidateResult } from "@shared/schema/transaction";
import type { UserAsset } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  assetOcrPendingReview,
  documents,
  ocrJobDetailKey,
  ocrJobsList,
} from "@shared/api/queryKeys";

interface OcrResultReviewProps {
  pipeline: DocumentOcrPipelineResult;
  extractedValues: ExtractedAmount[];
  assets: UserAsset[];
  /** When set, review outcome is persisted and linked transactions are recorded on accept. */
  ocrJobId?: string;
  /**
   * When false (e.g. asset page), hides balance amount/asset editing; user only confirms or dismisses holdings review.
   * @default true
   */
  showBalanceEditor?: boolean;
  onConfirmed: () => void;
  onDismissed: () => void;
  onBalancesSaved: (data: { assetId: string; value: number }[]) => void;
}

function invalidatePendingOcrQueries(
  pipeline: DocumentOcrPipelineResult,
  assetsList: UserAsset[]
) {
  const assetId = primaryAssetIdForCandidateScope(pipeline, assetsList);
  if (assetId) {
    queryClient.invalidateQueries({
      queryKey: [...assetOcrPendingReview, assetId],
    });
  }
}

function invalidateOcrJobListQueries(ocrJobId: string | undefined) {
  if (!ocrJobId) return;
  void queryClient.invalidateQueries({ queryKey: ocrJobsList });
  void queryClient.invalidateQueries({ queryKey: ocrJobDetailKey(ocrJobId) });
  void queryClient.invalidateQueries({ queryKey: documents });
}

async function postOcrJobReview(
  jobId: string,
  body:
    | { outcome: "rejected" }
    | { outcome: "accepted"; securityTransactionIds: string[] }
): Promise<void> {
  await apiRequest("POST", `/api/ocr-jobs/${jobId}/review`, body);
}

/**
 * Portfolio account used to collapse the candidate list: pipeline nominee first,
 * else the only asset in scope (asset page). Record page with many accounts → null (show all).
 */
function primaryAssetIdForCandidateScope(
  pipeline: DocumentOcrPipelineResult,
  assetsList: UserAsset[]
): string | null {
  if (pipeline.nominatedUserAssetId) {
    return pipeline.nominatedUserAssetId;
  }
  if (assetsList.length === 1) {
    return assetsList[0]!.id;
  }
  return null;
}

function deriveInitialCandidate(
  candidates: OcrAssetCandidateResult[],
  primaryAssetId: string | null
): string | null {
  const fullMatches = candidates.filter((c) => c.matchedCount === c.totalCount);

  if (primaryAssetId) {
    const primary = candidates.find((c) => c.userAssetId === primaryAssetId);
    if (primary && primary.matchedCount === primary.totalCount) {
      return primary.userAssetId;
    }
  }

  if (fullMatches.length === 1) {
    return fullMatches[0]!.userAssetId;
  }

  if (primaryAssetId) {
    const primary = candidates.find((c) => c.userAssetId === primaryAssetId);
    if (primary) {
      return primary.userAssetId;
    }
  }

  return null;
}

export function OcrResultReview({
  pipeline,
  extractedValues,
  assets,
  ocrJobId,
  showBalanceEditor = true,
  onConfirmed,
  onDismissed,
  onBalancesSaved,
}: OcrResultReviewProps) {
  const { assetCandidates } = pipeline;

  const primaryAssetId = useMemo(
    () => primaryAssetIdForCandidateScope(pipeline, assets),
    [pipeline, assets]
  );

  const hasPrimaryInCandidates =
    primaryAssetId !== null &&
    assetCandidates.some((c) => c.userAssetId === primaryAssetId);

  const [showAllAssetCandidates, setShowAllAssetCandidates] = useState(() => !hasPrimaryInCandidates);

  const visibleAssetCandidates = useMemo(() => {
    if (showAllAssetCandidates || primaryAssetId === null) {
      return assetCandidates;
    }
    const narrowed = assetCandidates.filter((c) => c.userAssetId === primaryAssetId);
    return narrowed.length > 0 ? narrowed : assetCandidates;
  }, [assetCandidates, primaryAssetId, showAllAssetCandidates]);

  const otherCandidateCount = assetCandidates.length - visibleAssetCandidates.length;

  const initialSelected = useMemo(
    () => deriveInitialCandidate(assetCandidates, primaryAssetId),
    [assetCandidates, primaryAssetId]
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
        invalidateOcrJobListQueries(ocrJobId);
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
      invalidateOcrJobListQueries(ocrJobId);
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
        <OcrResultsEmptyState message="No portfolio holdings matched the securities in this document." />

        {pipeline.securityHoldings.length > 0 && (
          <div className="space-y-1">
            <OcrResultsSubjectHeading className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Extracted rows (unmatched)
            </OcrResultsSubjectHeading>
            <OcrResultsPlainHoldingRows
              rows={pipeline.securityHoldings.map((row, i) => ({
                key: `${i}-${row.symbol ?? row.name ?? "row"}`,
                label: row.name ?? row.symbol ?? "Unknown security",
              }))}
            />
          </div>
        )}

        {showBalanceEditor ? (
          <OcrBalanceReview
            extractedValues={extractedValues}
            assets={assets}
            onSave={onBalancesSaved}
          />
        ) : null}

        {confirmError && (
          <p className="text-sm text-destructive">{confirmError}</p>
        )}

        <Button variant="outline" onClick={() => void finishDismissed()} className="w-full">
          <X className="h-4 w-4 mr-2" />
          {showBalanceEditor ? "Dismiss" : "Reject"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <OcrResultsSubjectHeading>
          {!showAllAssetCandidates && visibleAssetCandidates.length === 1
            ? "Review matches for this portfolio account"
            : assetCandidates.length === 1
              ? "Matched portfolio account"
              : "Select the portfolio account this statement belongs to"}
        </OcrResultsSubjectHeading>

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

        {showAllAssetCandidates &&
        primaryAssetId !== null &&
        assetCandidates.some((c) => c.userAssetId === primaryAssetId) &&
        assetCandidates.length > 1 ? (
          <button
            type="button"
            onClick={() => setShowAllAssetCandidates(false)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Show only this portfolio account
          </button>
        ) : null}
      </div>

      {hasSuspectRows && (
        <OcrResultsWarningNotice>
          Some rows were flagged as suspect. Review them before confirming.
        </OcrResultsWarningNotice>
      )}

      {confirmError && (
        <p className="text-sm text-destructive">{confirmError}</p>
      )}

      {showBalanceEditor ? (
        <OcrBalanceReview
          extractedValues={extractedValues}
          assets={assets}
          onSave={onBalancesSaved}
        />
      ) : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => void finishDismissed()}
          className="flex-1"
          disabled={isConfirming}
        >
          <X className="h-4 w-4 mr-2" />
          {showBalanceEditor ? "Dismiss" : "Reject"}
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
