import type { ReactNode } from "react";

type OcrResultsMetaRowProps = {
  label: string;
  children: ReactNode;
  /** When the value should align with status chips in the row. */
  align?: "start" | "center";
};

export function OcrResultsMetaRow({ label, children, align = "start" }: OcrResultsMetaRowProps) {
  return (
    <div
      className={
        align === "center"
          ? "flex flex-wrap gap-x-4 gap-y-1 items-center"
          : "flex flex-wrap gap-x-4 gap-y-1 items-start"
      }
    >
      <span className="text-muted-foreground shrink-0 min-w-[7rem]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
