import { useCallback, useEffect, useState } from "react";
import { GrowthRateScenario } from "./use-fire";

type GrowthMode = "global" | "contributor";

//const GROWTH_MODE_KEY = "fire-growth-mode";
const GROWTH_RATE_SCENARIO_KEY = "fire-growth-rate-scenario";
const CHART_VISIBLE_KEY = "fire-chart-visible";

const getWindow = () => (typeof window === "undefined" ? null : window);

// const readGrowthMode = (): GrowthMode => {
//   const win = getWindow();
//   if (!win) return "global";

//   const saved = win.localStorage.getItem(GROWTH_MODE_KEY);
//   return saved === "contributor" ? "contributor" : "global";
// };

const DEFAULT_GROWTH_RATE_SCENARIO: GrowthRateScenario = {
  id: "base",
  rate: 8,
  label: "Base (8%)",
};

const readGrowthRateScenario = (): GrowthRateScenario => {
  const win = getWindow();
  if (!win) return DEFAULT_GROWTH_RATE_SCENARIO;

  const saved = win.localStorage.getItem(GROWTH_RATE_SCENARIO_KEY);
  if (saved === null) return DEFAULT_GROWTH_RATE_SCENARIO;

  return JSON.parse(saved);
};
const readChartVisibility = (): boolean => {
  const win = getWindow();
  if (!win) return false;

  const saved = win.localStorage.getItem(CHART_VISIBLE_KEY);
  if (saved === null) return false;
  return saved === "true";
};

/**
 * Growth mode is currently disabled as the app will not supoort teh option
 * until the next phase of application.
 * Code has been left in place to reestablish later.
 */

export function useFirePreferences() {
  //const [growthMode, setGrowthMode] = useState<GrowthMode>(() => readGrowthMode());
  const [growthRateScenario, setGrowthRateScenario] = useState<GrowthRateScenario>(() => readGrowthRateScenario());
  const [showChart, setShowChart] = useState<boolean>(() => readChartVisibility());

  // useEffect(() => {
  //   const win = getWindow();
  //   if (!win) return;
  //   win.localStorage.setItem(GROWTH_MODE_KEY, growthMode);
  // }, [growthMode]);

  useEffect(() => {
    const win = getWindow();
    if (!win) return;
    win.localStorage.setItem(GROWTH_RATE_SCENARIO_KEY, JSON.stringify(growthRateScenario));
  }, [growthRateScenario]);

  useEffect(() => {
    const win = getWindow();
    if (!win) return;
    win.localStorage.setItem(CHART_VISIBLE_KEY, String(showChart));
  }, [showChart]);

  const toggleChart = useCallback(() => {
    setShowChart((prev) => !prev);
  }, []);

  return {
    //growthMode,
    //setGrowthMode,
    growthRateScenario,
    setGrowthRateScenario,
    showChart,
    setShowChart,
    toggleChart,
  };
}

export type FireGrowthMode = GrowthMode;

