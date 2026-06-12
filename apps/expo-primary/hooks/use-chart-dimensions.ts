import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import {
  createChartDimensions,
  type ChartDimensions,
  type ChartDimensionsOptions,
} from "@milestone/js-common/react/chart/types";

export type { ChartDimensions, ChartDimensionsOptions };

export function useChartDimensions(
  options: ChartDimensionsOptions = {}
): ChartDimensions {
  const { width } = useWindowDimensions();

  return useMemo(
    () => createChartDimensions(width, options),
    [width, options.height, options.marginTop, options.marginRight, options.marginBottom, options.marginLeft]
  );
}
