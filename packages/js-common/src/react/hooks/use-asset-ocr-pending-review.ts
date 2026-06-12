import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { assetOcrPendingReview } from "../../api/queryKeys";
import { assetOcrPendingReviewItemSchema } from "../../schema/document";
import type { AssetOcrPendingReviewItem } from "../../schema/document";

export function useAssetOcrPendingReview(assetId: string | undefined) {
  return useQuery<AssetOcrPendingReviewItem[]>({
    queryKey: assetId ? [...assetOcrPendingReview, assetId] : ["asset", "ocr-pending-review", "disabled"],
    enabled: !!assetId,
    queryFn: async () => {
      const raw = await apiRequest<unknown>(
        "GET",
        `/api/assets/${assetId}/ocr-pending-review`
      );
      const parsed = assetOcrPendingReviewItemSchema.array().safeParse(raw);
      if (!parsed.success) {
        console.error("ocr pending review parse error", parsed.error);
        throw new Error("Invalid OCR pending review response");
      }
      return parsed.data;
    },
  });
}
