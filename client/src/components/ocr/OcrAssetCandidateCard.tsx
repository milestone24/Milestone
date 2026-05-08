import { OcrCandidateSecurityRow } from "./OcrCandidateSecurityRow";
import type { OcrAssetCandidateResult } from "@shared/schema/ocr";

interface OcrAssetCandidateCardProps {
  candidate: OcrAssetCandidateResult;
  selected: boolean;
  onSelect: () => void;
}

export function OcrAssetCandidateCard({
  candidate,
  selected,
  onSelect,
}: OcrAssetCandidateCardProps) {
  const {
    assetName,
    matchedCount,
    totalCount,
    securities,
    alignsWithMatchedStatementPlatform = false,
  } = candidate;
  const isFullMatch = matchedCount === totalCount;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full text-left rounded-lg border p-4 space-y-3 transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : alignsWithMatchedStatementPlatform
            ? "border-sky-500/50 bg-sky-500/5 hover:border-sky-500/60"
            : "hover:border-muted-foreground/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-medium text-sm">{assetName}</span>
          {alignsWithMatchedStatementPlatform ? (
            <span className="text-xs text-sky-700 dark:text-sky-400 font-medium">
              Same broker platform as statement
            </span>
          ) : null}
        </div>
        <span
          className={[
            "text-xs px-2 py-0.5 rounded shrink-0",
            isFullMatch
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          ].join(" ")}
        >
          {matchedCount} / {totalCount} matched
        </span>
      </div>

      <div className="space-y-1">
        {securities.map((s, i) => (
          <OcrCandidateSecurityRow key={i} security={s} />
        ))}
      </div>
    </button>
  );
}
