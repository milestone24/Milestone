import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OcrResultsSubjectHeadingProps = {
  children: ReactNode;
  className?: string;
};

export function OcrResultsSubjectHeading({ children, className }: OcrResultsSubjectHeadingProps) {
  return <p className={cn("text-sm font-medium", className)}>{children}</p>;
}
