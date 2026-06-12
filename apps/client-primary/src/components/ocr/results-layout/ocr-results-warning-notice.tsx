import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type OcrResultsWarningNoticeProps = {
  children: ReactNode;
};

export function OcrResultsWarningNotice({ children }: OcrResultsWarningNoticeProps) {
  return (
    <div className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
