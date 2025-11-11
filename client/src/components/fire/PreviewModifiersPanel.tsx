import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { PreviewModifiersState } from "@/hooks/use-fire-preview-state";
import { DEFAULT_PREVIEW_INFLATION_RATE } from "@/hooks/use-fire-preview-state";

type PreviewModifiersPanelProps = {
  value: PreviewModifiersState;
  onChange: (next: PreviewModifiersState) => void;
  onReset: () => void;
};

const contributionPresets: Array<{ label: string; scale: number }> = [
  { label: "50%", scale: 0.5 },
  { label: "75%", scale: 0.75 },
  { label: "100%", scale: 1 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2 },
];

export function PreviewModifiersPanel({ value, onChange, onReset }: PreviewModifiersPanelProps) {
  const contributionPercentage = Math.round(value.contribution.scaleFactor * 100);
  const contributionActive = value.contribution.scaleFactor !== 1;
  const inflationActive =
    value.inflation.enabled === false ||
    Math.abs(value.inflation.rate - DEFAULT_PREVIEW_INFLATION_RATE) > 0.01;
  const modifiersActive = contributionActive || inflationActive;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium">Preview Modifiers</CardTitle>
            <p className="text-sm text-muted-foreground">
              Adjust contributions and inflation to explore what-if scenarios. These changes are not saved.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
        {modifiersActive && (
          <Badge variant="default">Preview active</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-foreground">Contribution multiplier</h3>
              <p className="text-xs text-muted-foreground">
                Scale your monthly contributions for preview purposes.
              </p>
            </div>
            <Badge variant="secondary">{contributionPercentage}%</Badge>
          </div>

          <Slider
            value={[value.contribution.scaleFactor]}
            min={0}
            max={3}
            step={0.05}
            onValueChange={([scale]) => {
              if (typeof scale !== "number") return;
              onChange({
                ...value,
                contribution: {
                  ...value.contribution,
                  enabled: scale > 0,
                  scaleFactor: Number(scale.toFixed(2)),
                },
              });
            }}
          />

          <div className="flex flex-wrap gap-2">
            {contributionPresets.map((preset) => (
              <Button
                key={preset.label}
                variant={value.contribution.scaleFactor === preset.scale ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    contribution: {
                      ...value.contribution,
                      enabled: preset.scale > 0,
                      scaleFactor: preset.scale,
                    },
                  })
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-foreground">Inflation override</h3>
              <p className="text-xs text-muted-foreground">
                Simulate different inflation environments in your preview.
              </p>
            </div>
            <Switch
              checked={value.inflation.enabled}
              onCheckedChange={(checked) =>
                onChange({
                  ...value,
                  inflation: {
                    ...value.inflation,
                    enabled: Boolean(checked),
                  },
                })
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="inflation-rate" className="text-xs text-muted-foreground">
              Inflation rate (%)
            </Label>
            <Input
              id="inflation-rate"
              type="number"
              step="0.1"
              min={0}
              max={10}
              value={value.inflation.rate}
              onChange={(event) =>
                onChange({
                  ...value,
                  inflation: {
                    ...value.inflation,
                    rate: Number(event.target.value),
                  },
                })
              }
              className="w-24"
              disabled={!value.inflation.enabled}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

