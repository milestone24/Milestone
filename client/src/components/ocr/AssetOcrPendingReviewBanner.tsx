import { Button } from "@/components/ui/button";
import type { AssetOcrPendingReviewItem } from "@shared/schema/document";

interface AssetOcrPendingReviewBannerProps {
  items: AssetOcrPendingReviewItem[];
  onOpenItem: (item: AssetOcrPendingReviewItem) => void;
}

export function AssetOcrPendingReviewBanner({
  items,
  onOpenItem,
}: AssetOcrPendingReviewBannerProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <p className="text-sm font-medium">
        {items.length === 1
          ? "A statement OCR result is ready to review."
          : `${items.length} statement OCR results are ready to review.`}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.ocrJobId} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">
              {item.fileName ?? "Document"}
              {item.completedAt
                ? ` · ${item.completedAt.toLocaleString()}`
                : null}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={() => onOpenItem(item)}>
              Review
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
