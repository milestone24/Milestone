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
import { GrowthRateScenario } from "@/hooks/use-fire";

// export type FireScenario = "pessimistic" | "base" | "optimistic" | "custom";

// const PRESET_SCENARIOS: { id: FireScenario; label: string; rate: number }[] = [
//   { id: "base", label: "Base (8%)", rate: 8 },
//   { id: "optimistic", label: "Optimistic (10%)", rate: 10 },
//   { id: "pessimistic", label: "Pessimistic (5%)", rate: 5 },
// ];

const SLIDER_MIN = 0;
const SLIDER_MAX = 20;
const SLIDER_STEP = 0.1;
const SLIDER_TICKS = [0, 5, 10, 15, 20];

type FireScenarioSelectorProps = {
  activeScenario: GrowthRateScenario;
  baseGrowthRate: number;
  onSelect: (scenario: GrowthRateScenario) => void;
  onReset: () => void;
};

const PRESET_SCENARIOS: GrowthRateScenario[] = [
  {
    id: "pessimistic",
    rate: 5,
    label: "Pessimistic (5%)",
  },
  {
    id: "base",
    rate: 8,
    label: "Base (8%)",
  },
  {
    id: "optimistic",
    rate: 10,
    label: "Optimistic (10%)",
  },
  {
    id: "custom",
    rate: 0,
    label: "Custom",
  },
];

export function FireScenarioSelector({
  activeScenario,
  baseGrowthRate,
  onSelect,
  onReset,
}: FireScenarioSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(baseGrowthRate);

  const handlePresetClick = (scenario: GrowthRateScenario) => {
    if (activeScenario?.id === scenario.id) {
      onReset();
    } else {
      onSelect(scenario);
    }
  };

  const handleCustomOpen = () => {
    setSliderValue(activeScenario.rate ?? baseGrowthRate);
    setDialogOpen(true);
  };

  const handleApply = () => {
    onSelect({ id: "custom", rate: sliderValue, label: "Custom" });
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
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full text-xs font-medium border transition-all",
              activeScenario.id === scenario.id
                ? "border-foreground text-foreground font-semibold"
                : "border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
            )}
            onClick={() =>
              scenario.id === "custom"
                ? handleCustomOpen()
                : handlePresetClick(scenario)
            }
          >
            {scenario.label}
          </Button>
        ))}
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
            <Button className="flex-1 rounded-xl" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
