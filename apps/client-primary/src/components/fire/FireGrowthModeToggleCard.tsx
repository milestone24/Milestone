import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FireGrowthMode } from "@/hooks/use-fire-preferences";
import { Badge } from "@/components/ui/badge";

type FireGrowthModeToggleCardProps = {
  growthMode: FireGrowthMode;
  onChange: (mode: FireGrowthMode) => void;
};

export function FireGrowthModeToggleCard({ growthMode, onChange }: FireGrowthModeToggleCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">Growth Rate Mode</CardTitle>
          <Badge variant={growthMode === "contributor" ? "default" : "secondary"}>
            {growthMode === "contributor" ? "Contributor-specific" : "Global rate"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose whether projections use the global expected return or contributor-specific growth rates.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 rounded-md bg-muted p-1">
          <Button
            variant={growthMode === "global" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => onChange("global")}
          >
            Global Rate
          </Button>
          <Button
            variant={growthMode === "contributor" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => onChange("contributor")}
          >
            Contributor Rates
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Contributor mode prioritises growth assumptions defined against individual assets or income sources.
        </p>
      </CardContent>
    </Card>
  );
}

