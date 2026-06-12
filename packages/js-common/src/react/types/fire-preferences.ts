export type GrowthRateScenario =
  | {
      id: "pessimistic" | "base" | "optimistic";
      rate: number;
      label: string;
    }
  | {
      id: "custom";
      rate: number;
      label: "Custom";
    };

export type FireGrowthMode = "global" | "contributor";
