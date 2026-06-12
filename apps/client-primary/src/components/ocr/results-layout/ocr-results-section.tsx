import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OcrResultsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared card chrome for OCR result areas (matches “Import from statement” density).
 */
export function OcrResultsSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: OcrResultsSectionProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground font-normal pt-0.5">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className={cn("space-y-2 text-sm", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
