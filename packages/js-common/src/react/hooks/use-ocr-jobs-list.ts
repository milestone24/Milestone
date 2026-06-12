import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { ocrJobsList } from "../../api/queryKeys";
import { ocrJobListItemSchema, type OcrJobListItem } from "../../schema/document";

export function useOcrJobsList() {
  return useQuery<OcrJobListItem[]>({
    queryKey: ocrJobsList,
    queryFn: async () => {
      const response = await apiRequest<unknown>("GET", "/api/ocr-jobs");
      const result = ocrJobListItemSchema.array().safeParse(response);
      if (!result.success) {
        throw new Error(`Invalid OCR jobs response: ${result.error.message}`);
      }
      return result.data;
    },
  });
}
