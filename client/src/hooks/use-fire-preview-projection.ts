import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Contributor,
  ProjectionConfig,
  ProjectionConfigWithDateRange,
  FIREProjectionConfig,
  FireProjection,
} from "@shared/schema/projections";
import { projectToRetirement } from "@shared/utils/projection-fire-calculator";

export type UseFirePreviewProjectionParams = {
  //baseProjection?: FireProjectionView;
  baseProjection?: FireProjection;
  fireConfig?: FIREProjectionConfig | null;
  projectionConfig?: ProjectionConfig | null;
  contributors: Contributor[];
  enabled?: boolean;
}

export type PreviewState = {
  projection?: FireProjection;
  error: Error | null;
  status: "idle" | "loading" | "success" | "error";
}

export function useFirePreviewProjection({
  baseProjection,
  fireConfig,
  projectionConfig,
  contributors,
  enabled = true,
}: UseFirePreviewProjectionParams) {
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    error: null,
    projection: undefined,
  });
  const [refetchToken, setRefetchToken] = useState(0);

  const lockedConfig = baseProjection?.projectionResult?.config;

  const hasRequirements =
    enabled && !!baseProjection && !!fireConfig && !!projectionConfig;

  useEffect(() => {
    let cancelled = false;

    if (!hasRequirements) {
      setState((prev) => {
        if (
          prev.status === "idle" &&
          prev.projection === undefined &&
          prev.error === null
        ) {
          return prev;
        }

        return { status: "idle", error: null, projection: undefined };
      });
      return () => {
        cancelled = true;
      };
    }

    const runProjection = async () => {
      setState((prev) =>
        prev.status === "loading" && prev.error === null
          ? prev
          : { ...prev, status: "loading", error: null }
      );
      try {
        const configToUse =
          lockedConfig != null
            ? ({ ...lockedConfig, ...projectionConfig } as ProjectionConfigWithDateRange)
            : projectionConfig;
        const result = await projectToRetirement(
          fireConfig,
          configToUse,
          contributors
        );

        if (cancelled) return;

        setState((prev) => {
          if (
            prev.status === "success" &&
            prev.projection === result &&
            prev.error === null
          ) {
            return prev;
          }

          return { status: "success", projection: result, error: null };
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          projection: undefined,
          error:
            error instanceof Error
              ? error
              : new Error("Failed to compute preview"),
        });
      }
    };

    runProjection();

    return () => {
      cancelled = true;
    };
  }, [
    hasRequirements,
    fireConfig,
    projectionConfig,
    contributors,
    baseProjection,
    refetchToken,
    lockedConfig,
  ]);

  const refetch = useCallback(() => {
    setRefetchToken((token) => token + 1);
  }, []);

  const memoisedProjection = useMemo(
    () => state.projection,
    [state.projection]
  );

  return {
    projection: memoisedProjection,
    isLoading: state.status === "loading",
    status: state.status,
    error: state.error,
    refetch,
  };
}
