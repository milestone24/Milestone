import { cn } from "@/lib/utils";

type OcrResultsCodeBlockProps = {
  children: string;
  className?: string;
};

export function OcrResultsCodeBlock({ children, className }: OcrResultsCodeBlockProps) {
  return (
    <pre
      className={cn(
        "text-xs bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono",
        className
      )}
    >
      {children}
    </pre>
  );
}
