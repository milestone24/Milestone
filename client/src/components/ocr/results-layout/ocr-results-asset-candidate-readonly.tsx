import { OcrCandidateSecurityRow } from "@/components/ocr/OcrCandidateSecurityRow";
import type { OcrAssetCandidateResult } from "@shared/schema/transaction";
import { cn } from "@/lib/utils";

type OcrResultsAssetCandidateReadonlyProps = {
  candidate: OcrAssetCandidateResult;
  /** Optional visual emphasis (e.g. nominated account on asset page). */
  emphasized?: boolean;
};

/**
 * Non-interactive portfolio match card — same spacing/border language as {@link OcrAssetCandidateCard}.
 */
export function OcrResultsAssetCandidateReadonly({
  candidate,
  emphasized = false,
}: OcrResultsAssetCandidateReadonlyProps) {
  const { assetName, matchedCount, totalCount, securities } = candidate;
  const isFullMatch = matchedCount === totalCount;

  return (
    <div
      className={cn(
        "w-full rounded-lg border p-4 space-y-3 text-left",
        emphasized ? "border-primary bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{assetName}</span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded shrink-0",
            isFullMatch
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          )}
        >
          {matchedCount} / {totalCount} matched
        </span>
      </div>

      <div className="space-y-1">
        {securities.map((s, i) => (
          <OcrCandidateSecurityRow key={i} security={s} />
        ))}
      </div>
    </div>
  );
}
