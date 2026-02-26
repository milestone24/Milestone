import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type FireScenario = "pessimistic" | "base" | "optimistic" | "custom";

const PRESET_SCENARIOS: { id: FireScenario; label: string; rate: number }[] = [
  { id: "pessimistic", label: "Pessimistic", rate: 5 },
  { id: "base", label: "Base", rate: 8 },
  { id: "optimistic", label: "Optimistic", rate: 10 },
];

const SLIDER_MIN = 0;
const SLIDER_MAX = 20;
const SLIDER_STEP = 0.1;
const SLIDER_TICKS = [0, 5, 10, 15, 20];

type FireScenarioSelectorProps = {
  activeScenario: FireScenario | null;
  activeGrowthRate: number | null;
  baseGrowthRate: number;
  onSelect: (scenario: FireScenario, rate: number) => void;
  onReset: () => void;
};

export function FireScenarioSelector({
  activeScenario,
  activeGrowthRate,
  baseGrowthRate,
  onSelect,
  onReset,
}: FireScenarioSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(baseGrowthRate);

  const handlePresetClick = (scenario: typeof PRESET_SCENARIOS[number]) => {
    if (activeScenario === scenario.id) {
      onReset();
    } else {
      onSelect(scenario.id, scenario.rate);
    }
  };

  const handleCustomOpen = () => {
    setSliderValue(activeGrowthRate ?? baseGrowthRate);
    setDialogOpen(true);
  };

  const handleApply = () => {
    onSelect("custom", sliderValue);
    setDialogOpen(false);
  };

  const handleCancel = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <div className="flex gap-2">
        {PRESET_SCENARIOS.map((scenario) => (
          <Button
            key={scenario.id}
            variant={activeScenario === scenario.id ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-full text-xs font-medium",
              activeScenario === scenario.id && "shadow-none"
            )}
            onClick={() => handlePresetClick(scenario)}
          >
            {scenario.label}
          </Button>
        ))}
        <Button
          variant={activeScenario === "custom" ? "default" : "outline"}
          size="sm"
          className={cn(
            "rounded-full text-xs font-medium",
            activeScenario === "custom" && "shadow-none"
          )}
          onClick={handleCustomOpen}
        >
          Custom
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Custom Return Rate
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-2 py-4">
            <div className="text-center">
              <span className="text-5xl font-bold text-primary">
                {sliderValue.toFixed(1)}
              </span>
              <span className="text-xl text-muted-foreground">%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Expected annual return
            </p>
          </div>

          <div className="px-2 pb-2">
            <Slider
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={SLIDER_STEP}
              value={[sliderValue]}
              onValueChange={([val]) => setSliderValue(val ?? SLIDER_MIN)}
              className="mb-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {SLIDER_TICKS.map((tick) => (
                <span key={tick}>{tick}%</span>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
