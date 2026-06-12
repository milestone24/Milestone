import { useCallback, useEffect, useState } from "react";
import {
  type FireGrowthMode,
  type GrowthRateScenario,
} from "../types/fire-preferences";
import { useStorage } from "../../platform/PlatformServicesProvider";

const GROWTH_RATE_SCENARIO_KEY = "fire-growth-rate-scenario";
const CHART_VISIBLE_KEY = "fire-chart-visible";

const DEFAULT_GROWTH_RATE_SCENARIO: GrowthRateScenario = {
  id: "base",
  rate: 8,
  label: "Base (8%)",
};

const parseGrowthRateScenario = (saved: string | null): GrowthRateScenario => {
  if (saved === null) return DEFAULT_GROWTH_RATE_SCENARIO;
  try {
    return JSON.parse(saved) as GrowthRateScenario;
  } catch {
    return DEFAULT_GROWTH_RATE_SCENARIO;
  }
};

/**
 * Growth mode is currently disabled as the app will not support the option
 * until the next phase of application.
 * Code has been left in place to reestablish later.
 */
export function useFirePreferences() {
  const storage = useStorage();
  const [growthRateScenario, setGrowthRateScenario] =
    useState<GrowthRateScenario>(DEFAULT_GROWTH_RATE_SCENARIO);
  const [showChart, setShowChart] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [savedScenario, savedChartVisible] = await Promise.all([
        storage.getItem(GROWTH_RATE_SCENARIO_KEY),
        storage.getItem(CHART_VISIBLE_KEY),
      ]);

      if (cancelled) return;

      setGrowthRateScenario(parseGrowthRateScenario(savedScenario));
      setShowChart(savedChartVisible === "true");
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!isHydrated) return;
    void storage.setItem(
      GROWTH_RATE_SCENARIO_KEY,
      JSON.stringify(growthRateScenario)
    );
  }, [growthRateScenario, isHydrated, storage]);

  useEffect(() => {
    if (!isHydrated) return;
    void storage.setItem(CHART_VISIBLE_KEY, String(showChart));
  }, [showChart, isHydrated, storage]);

  const toggleChart = useCallback(() => {
    setShowChart((prev) => !prev);
  }, []);

  return {
    growthRateScenario,
    setGrowthRateScenario,
    showChart,
    setShowChart,
    toggleChart,
  };
}

export type { FireGrowthMode, GrowthRateScenario };
