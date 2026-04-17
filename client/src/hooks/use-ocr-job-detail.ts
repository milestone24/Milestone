import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ocrJobDetailKey } from "@shared/api/queryKeys";
import { ocrJobDetailSchema, type OcrJobDetail } from "@shared/schema/document";

export function useOcrJobDetail(ocrJobId: string | undefined) {
  return useQuery<OcrJobDetail>({
    queryKey: ocrJobId ? ocrJobDetailKey(ocrJobId) : ["ocr-jobs", "detail", "none"],
    enabled: Boolean(ocrJobId),
    queryFn: async () => {
      const response = await apiRequest<unknown>(
        "GET",
        `/api/ocr-jobs/${encodeURIComponent(ocrJobId!)}`
      );
      const result = ocrJobDetailSchema.safeParse(response);
      if (!result.success) {
        throw new Error(`Invalid OCR job detail: ${result.error.message}`);
      }
      return result.data;
    },
  });
}
