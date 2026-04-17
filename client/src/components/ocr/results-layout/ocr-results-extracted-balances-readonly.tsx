import type { ExtractedAmount } from "@shared/schema/document";

type OcrResultsExtractedBalancesReadonlyProps = {
  values: ExtractedAmount[];
  /** When false, omit the leading title (parent section already has a title). */
  showHeading?: boolean;
};

/**
 * Read-only balance cards — visual rhythm aligned with {@link OcrBalanceReview} rows (no inputs).
 */
export function OcrResultsExtractedBalancesReadonly({
  values,
  showHeading = true,
}: OcrResultsExtractedBalancesReadonlyProps) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {showHeading ? <p className="text-sm font-medium">Extracted balances</p> : null}
      {values.map((v, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{v.platformName}</span>
            {v.accountType ? (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                {v.accountType}
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Amount</span>
            <span className="text-sm tabular-nums">{v.amount.toLocaleString()}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Confidence: {Math.round(v.confidence * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}
