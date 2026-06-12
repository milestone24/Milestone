import { useMemo } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "../chart/types";
import type { ProcessedTrackChartData } from "./use-track-chart-data";

export type TrackChartScales = {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
};

export function useTrackChartScales(
  dimensions: ChartDimensions,
  processedData: ProcessedTrackChartData
): TrackChartScales {
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
