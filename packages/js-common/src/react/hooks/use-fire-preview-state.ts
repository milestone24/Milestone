import { useCallback, useMemo, useState } from "react";
import type { ProjectionModifier } from "../../schema";

export type ContributionPreviewState = {
  enabled: boolean;
  scaleFactor: number;
};

export type InflationPreviewState = {
  enabled: boolean;
  rate: number;
};

export const DEFAULT_PREVIEW_INFLATION_RATE = 2.8;

export type PreviewModifiersState = {
  contribution: ContributionPreviewState;
  inflation: InflationPreviewState;
};

export const DEFAULT_PREVIEW_STATE: PreviewModifiersState = {
  contribution: {
    enabled: true,
    scaleFactor: 1,
  },
  inflation: {
    enabled: true,
    rate: DEFAULT_PREVIEW_INFLATION_RATE,
  },
};

export function useFirePreviewState(initialState: PreviewModifiersState = DEFAULT_PREVIEW_STATE) {
  const [previewState, setPreviewState] = useState<PreviewModifiersState>(initialState);

  const setContribution = useCallback((updater: ContributionPreviewState | ((prev: ContributionPreviewState) => ContributionPreviewState)) => {
    setPreviewState((prev) => ({
      ...prev,
      contribution: typeof updater === "function" ? (updater as (prev: ContributionPreviewState) => ContributionPreviewState)(prev.contribution) : updater,
    }));
  }, []);

  const setInflation = useCallback((updater: InflationPreviewState | ((prev: InflationPreviewState) => InflationPreviewState)) => {
    setPreviewState((prev) => ({
      ...prev,
      inflation: typeof updater === "function" ? (updater as (prev: InflationPreviewState) => InflationPreviewState)(prev.inflation) : updater,
    }));
  }, []);

  const resetPreviewState = useCallback(() => {
    setPreviewState(DEFAULT_PREVIEW_STATE);
  }, []);

  const previewModifiers = useMemo<ProjectionModifier[]>(() => {
    const modifiers: ProjectionModifier[] = [];

    if (previewState.inflation.enabled) {
      modifiers.push({
        type: "inflation",
        enabled: true,
        rate: previewState.inflation.rate,
        description: "Inflation Preview",
      });
    }

    modifiers.push({
      type: "contribution_scaler",
      enabled: previewState.contribution.enabled,
      scaleFactor: previewState.contribution.scaleFactor,
      description: "Contribution Preview",
    });

    return modifiers;
  }, [previewState]);

  return {
    previewState,
    setPreviewState,
    setContribution,
    setInflation,
    previewModifiers,
    resetPreviewState,
  };
}

