import { useMemo } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "./use-chart-dimensions";
import type { ProcessedChartData } from "./use-chart-data";

export type ChartScales = {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
};

export function useChartScales(
  dimensions: ChartDimensions,
  processedData: ProcessedChartData
): ChartScales {
  return useMemo(() => {
    const xScale = d3
      .scaleLinear()
      .domain([processedData.minTimestamp, processedData.maxTimestamp])
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
