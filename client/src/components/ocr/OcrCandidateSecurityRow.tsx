import type { OcrAssetCandidateSecurity } from "@shared/schema/transaction";

interface OcrCandidateSecurityRowProps {
  security: OcrAssetCandidateSecurity;
}

export function OcrCandidateSecurityRow({ security }: OcrCandidateSecurityRowProps) {
  const { ocrRow, verified, matched } = security;
  const label = ocrRow.name ?? ocrRow.symbol ?? "Unknown security";

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md border text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate font-medium">{label}</span>
        {ocrRow.symbol && ocrRow.name && (
          <span className="text-xs text-muted-foreground shrink-0">{ocrRow.symbol}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-xs text-muted-foreground">
          {Math.round(ocrRow.confidence * 100)}% confidence
        </span>

        {!verified && (
          <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded">
            suspect
          </span>
        )}

        {matched ? (
          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">
            matched
          </span>
        ) : (
          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
            unmatched
          </span>
        )}
      </div>
    </div>
  );
}
