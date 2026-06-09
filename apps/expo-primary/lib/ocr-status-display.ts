export {
  OCR_JOB_STATUS_LABEL,
  OCR_REVIEW_STATUS_LABEL,
} from "@milestone/js-common/utils/ocr-status-display";

export const OCR_JOB_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  aborted: "bg-yellow-100 text-yellow-800",
};
