import { OcrCandidateSecurityRow } from "./OcrCandidateSecurityRow";
import type { OcrAssetCandidateResult } from "@shared/schema/transaction";

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
  const { assetName, matchedCount, totalCount, securities } = candidate;
  const isFullMatch = matchedCount === totalCount;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full text-left rounded-lg border p-4 space-y-3 transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "hover:border-muted-foreground/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{assetName}</span>
        <span
          className={[
            "text-xs px-2 py-0.5 rounded",
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
