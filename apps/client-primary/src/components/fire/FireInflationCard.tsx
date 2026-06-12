import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { InflationPreviewState } from "@/hooks/use-fire-preview-state";
import { DEFAULT_PREVIEW_INFLATION_RATE } from "@/hooks/use-fire-preview-state";

type FireInflationCardProps = {
  inflationPreviewState: InflationPreviewState;
  onChange: (next: InflationPreviewState) => void;
  onReset: () => void;
};

const contributionPresets: Array<{ label: string; scale: number }> = [
  { label: "50%", scale: 0.5 },
  { label: "75%", scale: 0.75 },
  { label: "100%", scale: 1 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2 },
];

export function FireInflationCard({
  inflationPreviewState,
  onChange,
  onReset,
}: FireInflationCardProps) {
  const inflationActive =
    inflationPreviewState.enabled === false ||
    Math.abs(inflationPreviewState.rate - DEFAULT_PREVIEW_INFLATION_RATE) >
      0.01;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium">
              Inflation Preview
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Adjust inflation to explore what-if scenarios. These changes are
              not saved.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
        {inflationActive && <Badge variant="default">Preview active</Badge>}
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Inflation override
              </h3>
              <p className="text-xs text-muted-foreground">
                Simulate different inflation environments in your preview.
              </p>
            </div>
            <Switch
              checked={inflationPreviewState.enabled}
              onCheckedChange={(checked) =>
                onChange({
                  ...inflationPreviewState,
                  enabled: Boolean(checked),
                })
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="inflation-rate"
              className="text-xs text-muted-foreground"
            >
              Inflation rate (%)
            </Label>
            <Input
              id="inflation-rate"
              type="number"
              step="0.1"
              min={0}
              max={10}
              value={inflationPreviewState.rate}
              onChange={(event) =>
                onChange({
                  ...inflationPreviewState,
                  rate: Number(event.target.value),
                })
              }
              className="w-24"
              disabled={!inflationPreviewState.enabled}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
