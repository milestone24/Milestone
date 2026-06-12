import { useEffect, useState } from "react";
import type { UserAsset } from "@milestone/js-common/schema";
import type { AssetOcrPendingReviewItem } from "@milestone/js-common/schema/document";
import { useAssetOcrPendingReview } from "@/hooks/use-asset-ocr-pending-review";
import { AssetOcrPendingReviewBanner } from "./AssetOcrPendingReviewBanner";
import { OcrResultReview } from "./OcrResultReview";

type AssetOcrPendingReviewSectionProps = {
  assetId: string;
  asset: UserAsset;
};

/**
 * Pending statement OCR banner + inline review for an asset (contributions / transactions tabs).
 */
export function AssetOcrPendingReviewSection({
  assetId,
  asset,
}: AssetOcrPendingReviewSectionProps) {
  const [activePendingOcr, setActivePendingOcr] =
    useState<AssetOcrPendingReviewItem | null>(null);
  const { data: pendingOcrItems = [] } = useAssetOcrPendingReview(assetId);

  useEffect(() => {
    setActivePendingOcr(null);
  }, [assetId]);

  if (pendingOcrItems.length === 0 && !activePendingOcr) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      <AssetOcrPendingReviewBanner
        items={pendingOcrItems}
        onOpenItem={setActivePendingOcr}
      />
      {activePendingOcr?.pipeline ? (
        <OcrResultReview
          key={activePendingOcr.ocrJobId}
          ocrJobId={activePendingOcr.ocrJobId}
          pipeline={activePendingOcr.pipeline}
          extractedValues={activePendingOcr.extractedValues ?? []}
          assets={[asset]}
          showBalanceEditor={false}
          onConfirmed={() => setActivePendingOcr(null)}
          onDismissed={() => setActivePendingOcr(null)}
          onBalancesSaved={() => {}}
        />
      ) : null}
    </div>
  );
}
