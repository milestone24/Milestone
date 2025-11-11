import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

type FirePageErrorProps = {
  error: Error;
  onRetry: () => void;
  className?: string;
};

export function FirePageError({ error, onRetry, className }: FirePageErrorProps) {
  const message =
    error.message && error.message !== "Network Error"
      ? error.message
      : "We couldn’t calculate your projection right now. This is usually a temporary issue.";

  return (
    <Card className={cn("border-destructive/40 bg-destructive/5", className)}>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="mt-1 rounded-full bg-destructive/10 p-2 text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <CardTitle className="text-destructive">Projection temporarily unavailable</CardTitle>
          <p className="text-sm text-muted-foreground">
            Don’t worry—your saved FIRE settings are safe. Try again in a few moments or adjust your
            inputs below.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-destructive">{message}</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">You can:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Retry the projection calculation.</li>
            <li>Review your FIRE settings or preview modifiers.</li>
            <li>Check your connection if the issue persists.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry}>Retry calculation</Button>
        </div>
      </CardContent>
    </Card>
  );
}

