import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type OcrResultsEmptyStateProps = {
  message: string;
  icon?: ReactNode;
};

export function OcrResultsEmptyState({ message, icon }: OcrResultsEmptyStateProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon ?? <AlertCircle className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}
