export const OCR_JOB_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Processing",
  completed: "Completed",
  failed: "Failed",
  aborted: "Aborted",
};

export const OCR_JOB_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  aborted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export const OCR_REVIEW_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
};
