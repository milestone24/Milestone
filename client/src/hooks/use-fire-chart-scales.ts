import { useMemo } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "./use-chart-dimensions";
import type { ProcessedFireChartData } from "./use-fire-chart-data";

export type FireChartScales = {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
};

export function useFireChartScales(
  dimensions: ChartDimensions,
  processedData: ProcessedFireChartData
): FireChartScales {
  return useMemo(() => {
    const xScale = d3
      .scaleLinear()
      .domain([processedData.minAge, processedData.maxAge])
      .range([0, dimensions.boundedWidth])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain([processedData.minValue, processedData.maxValue])
      .range([dimensions.boundedHeight, 0])
      .nice();

    return { xScale, yScale };
  }, [dimensions, processedData]);
}
