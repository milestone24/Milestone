type Row = { key: string; label: string };

/**
 * Simple bordered rows (e.g. extracted holdings labels) matching asset-page unmatched list styling.
 */
export function OcrResultsPlainHoldingRows({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div
          key={row.key}
          className="text-sm border rounded-md px-3 py-2 text-muted-foreground"
        >
          {row.label}
        </div>
      ))}
    </div>
  );
}
