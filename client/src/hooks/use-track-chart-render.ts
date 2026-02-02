import { useEffect, RefObject } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "./use-chart-dimensions";
import type { TrackChartScales } from "./use-track-chart-scales";
import type { ProcessedTrackChartData } from "./use-track-chart-data";

type CurveType =
  | "linear"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step"
  | "stepBefore"
  | "stepAfter"
  | "basis"
  | "cardinal"
  | "catmullRom";

type UseTrackChartRenderOptions = {
  svgRef: RefObject<SVGSVGElement>;
  dimensions: ChartDimensions;
  scales: TrackChartScales;
  processedData: ProcessedTrackChartData;
  curve?: CurveType;
};

const getCurveFactory = (curveType: CurveType) => {
  const curveMap = {
    linear: d3.curveLinear,
    monotoneX: d3.curveMonotoneX,
    monotoneY: d3.curveMonotoneY,
    natural: d3.curveNatural,
    step: d3.curveStep,
    stepBefore: d3.curveStepBefore,
    stepAfter: d3.curveStepAfter,
    basis: d3.curveBasis,
    cardinal: d3.curveCardinal,
    catmullRom: d3.curveCatmullRom,
  };
  return curveMap[curveType];
};

const formatCurrency = (value: number): string => {
  return `£${(value / 1000).toFixed(0)}k`;
};

export function useTrackChartRender({
  svgRef,
  dimensions,
  scales,
  processedData,
  curve = "monotoneX",
}: UseTrackChartRenderOptions) {
  useEffect(() => {
    if (!svgRef.current) return;
    if (dimensions.boundedWidth <= 0 || dimensions.boundedHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${dimensions.marginLeft},${dimensions.marginTop})`);

    const { chartData } = processedData;

    // Draw cartesian grid
    const yTicks = scales.yScale.ticks(5);
    g.selectAll(".grid-line")
      .data(yTicks)
      .join("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", dimensions.boundedWidth)
      .attr("y1", (d) => scales.yScale(d))
      .attr("y2", (d) => scales.yScale(d))
      .attr("stroke", "#f0f0f0")
      .attr("stroke-dasharray", "3 3");

    // Draw lines
    const curveFactory = getCurveFactory(curve);

    // Target line (red, dashed)
    const targetLine = d3
      .line<typeof chartData[0]>()
      .curve(curveFactory)
      .defined((d) => d.target != null && !isNaN(d.target))
      .x((d) => scales.xScale(d.age))
      .y((d) => scales.yScale(d.target));

    g.append("path")
      .datum(chartData)
      .attr("class", "line-target")
      .attr("fill", "none")
      .attr("stroke", "#EF4444")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5 5")
      .attr("d", targetLine);

    // Projected line (blue, solid)
    const projectedLine = d3
      .line<typeof chartData[0]>()
      .curve(curveFactory)
      .defined((d) => d.projected != null && !isNaN(d.projected))
      .x((d) => scales.xScale(d.age))
      .y((d) => scales.yScale(d.projected));

    g.append("path")
      .datum(chartData)
      .attr("class", "line-projected")
      .attr("fill", "none")
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 2)
      .attr("d", projectedLine);

    // Actual value marker (green dot at current age)
    const actualDataPoint = chartData.find((d) => d.actual !== null);
    if (actualDataPoint && actualDataPoint.actual !== null) {
      g.append("circle")
        .attr("cx", scales.xScale(actualDataPoint.age))
        .attr("cy", scales.yScale(actualDataPoint.actual))
        .attr("r", 5)
        .attr("fill", "#10B981")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);
    }

    // Draw X axis
    const xAxis = d3
      .axisBottom(scales.xScale)
      .ticks(5)
      .tickFormat((value) => value.toString());

    const xAxisGroup = g
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${dimensions.boundedHeight})`)
      .call(xAxis);

    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick line").remove();
    xAxisGroup.selectAll(".tick text").attr("font-size", 12).attr("fill", "#666");

    // X axis label
    g.append("text")
      .attr("x", dimensions.boundedWidth / 2)
      .attr("y", dimensions.boundedHeight + 35)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#666")
      .text("Age");

    // Draw Y axis
    const yAxis = d3
      .axisLeft(scales.yScale)
      .ticks(5)
      .tickFormat((value) => formatCurrency(value as number));

    const yAxisGroup = g.append("g").attr("class", "y-axis").call(yAxis);

    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick line").remove();
    yAxisGroup.selectAll(".tick text").attr("font-size", 12).attr("fill", "#666");
  }, [svgRef, dimensions, scales, processedData, curve]);
}
