import type { OcrAssetCandidateSecurity } from "@shared/schema/ocr";

interface OcrCandidateSecurityRowProps {
  security: OcrAssetCandidateSecurity;
}

function formatDecimal(value: string | undefined): string | null {
  if (!value) return null;
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function OcrCandidateSecurityRow({ security }: OcrCandidateSecurityRowProps) {
  const { ocrRow, verified, matched } = security;
  const label = ocrRow.name ?? ocrRow.symbol ?? "Unknown security";
  const hasSymbolAndName = !!(ocrRow.symbol && ocrRow.name);

  const units = formatDecimal(ocrRow.value);
  const currencyValue = formatDecimal(ocrRow.currencyValue);
  const fees = formatDecimal(ocrRow.fees);
  const valueDate = ocrRow.valueDate
    ? new Date(ocrRow.valueDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-md border text-sm divide-y">
      <div className="flex items-center justify-between py-2 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium">{label}</span>
          {hasSymbolAndName && (
            <span className="text-xs text-muted-foreground shrink-0">{ocrRow.symbol}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-3">
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

      <div className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
        {valueDate && (
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground/60">Date </span>{valueDate}
          </span>
        )}
        {units && (
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground/60">Units </span>{units}
          </span>
        )}
        {currencyValue && (
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground/60">Value </span>
            {ocrRow.currency ? `${ocrRow.currency} ` : ""}{currencyValue}
          </span>
        )}
        {fees && (
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground/60">Fees </span>{fees}
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {Math.round(ocrRow.confidence * 100)}% confidence
        </span>
      </div>
    </div>
  );
}
