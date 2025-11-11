import { useCallback, useEffect, useState } from "react";

type GrowthMode = "global" | "contributor";

const GROWTH_MODE_KEY = "fire-growth-mode";
const CHART_VISIBLE_KEY = "fire-chart-visible";

const getWindow = () => (typeof window === "undefined" ? null : window);

const readGrowthMode = (): GrowthMode => {
  const win = getWindow();
  if (!win) return "global";

  const saved = win.localStorage.getItem(GROWTH_MODE_KEY);
  return saved === "contributor" ? "contributor" : "global";
};

const readChartVisibility = (): boolean => {
  const win = getWindow();
  if (!win) return false;

  const saved = win.localStorage.getItem(CHART_VISIBLE_KEY);
  if (saved === null) return false;
  return saved === "true";
};

export function useFirePreferences() {
  const [growthMode, setGrowthMode] = useState<GrowthMode>(() => readGrowthMode());
  const [showChart, setShowChart] = useState<boolean>(() => readChartVisibility());

  useEffect(() => {
    const win = getWindow();
    if (!win) return;
    win.localStorage.setItem(GROWTH_MODE_KEY, growthMode);
  }, [growthMode]);

  useEffect(() => {
    const win = getWindow();
    if (!win) return;
    win.localStorage.setItem(CHART_VISIBLE_KEY, String(showChart));
  }, [showChart]);

  const toggleChart = useCallback(() => {
    setShowChart((prev) => !prev);
  }, []);

  return {
    growthMode,
    setGrowthMode,
    showChart,
    setShowChart,
    toggleChart,
  };
}

export type FireGrowthMode = GrowthMode;

