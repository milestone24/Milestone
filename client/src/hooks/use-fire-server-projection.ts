import { useMemo } from "react";
import { useFIREProjection } from "@/hooks/use-projections";
import type { SimpleProjectionConfig } from "@shared/schema/projections";
import { useDebouncedValue } from "./use-debounced-value";
import type { FireProjectionView } from "./use-fire-projection-state";

interface UseFireServerProjectionParams {
  config: Omit<SimpleProjectionConfig, "startDate" | "endDate"> | null;
  debounceMs?: number;
  enabled?: boolean;
}

export function useFireServerProjection({
  config,
  debounceMs = 500,
  enabled = true,
}: UseFireServerProjectionParams) {
  const debouncedConfig = useDebouncedValue(config, debounceMs);

  const query = useFIREProjection(enabled ? debouncedConfig : null);

  const projection = useMemo<FireProjectionView | undefined>(() => {
    if (!query.data) {
      return undefined;
    }

    return {
      ...query.data,
      state: "current",
    } as FireProjectionView;
  }, [query.data]);

  return {
    ...query,
    projection,
  };
}
