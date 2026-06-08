import { useEffect, RefObject } from "react";
import * as d3 from "d3";
import numabbr from "numabbr";
import type { ChartDimensions } from "./use-chart-dimensions";
import type { ChartScales } from "./use-chart-scales";
import type { TooltipData } from "./use-chart-interactions";
import type { ChartDataPoint, ChartData } from "./use-chart-data";

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

type Milestone = {
  id: string;
  targetValue: number;
  name: string;
  isCompleted: boolean;
};

type UseD3RenderOptions = {
  svgRef: RefObject<SVGSVGElement>;
  data: ChartData;
  dimensions: ChartDimensions;
  scales: ChartScales;
  milestones?: Milestone[];
  showMilestones?: boolean;
  tooltipData: TooltipData;
  curve?: CurveType;
};

// Map curve type string to D3 curve factory
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

export function useD3Render({
  svgRef,
  data,
  dimensions,
  scales,
  milestones,
  showMilestones,
  tooltipData,
  curve = "monotoneX",
}: UseD3RenderOptions) {
  useEffect(() => {
    if (!svgRef.current) return;
    if (dimensions.boundedWidth <= 0 || dimensions.boundedHeight <= 0) return;

    const svg = d3.select(svgRef.current);

    // Clear previous content
    svg.selectAll("*").remove();

    // Create main group with margins
    const g = svg
      .append("g")
      .attr("transform", `translate(${dimensions.marginLeft},${dimensions.marginTop})`);

    // Draw cartesian grid (horizontal lines only)
    // const yTicks = scales.yScale.ticks(5);
    // g.selectAll(".grid-line")
    //   .data(yTicks)
    //   .join("line")
    //   .attr("class", "grid-line")
    //   .attr("x1", 0)
    //   .attr("x2", dimensions.boundedWidth)
    //   .attr("y1", (d) => scales.yScale(d))
    //   .attr("y2", (d) => scales.yScale(d))
    //   .attr("stroke", "hsl(var(--border))")
    //   .attr("stroke-opacity", 0.5)
    //   .attr("stroke-dasharray", "3 3");

    // Draw reference lines (milestones)
    if (showMilestones && milestones && milestones.length > 0) {
      const milestoneGroup = g.append("g").attr("class", "milestones");

      milestones.forEach((milestone) => {
        const y = scales.yScale(Number(milestone.targetValue));

        // Reference line
        milestoneGroup
          .append("line")
          .attr("x1", 0)
          .attr("x2", dimensions.boundedWidth)
          .attr("y1", y)
          .attr("y2", y)
          .attr("stroke", "#F59E0B")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "5 5");

        // Label
        milestoneGroup
          .append("text")
          .attr("x", dimensions.boundedWidth)
          .attr("y", y - 5)
          .attr("fill", "#F59E0B")
          .attr("font-size", 12)
          .attr("text-anchor", "end")
          .text(`£${Number(milestone.targetValue).toLocaleString()}`);
      });
    }

    // Draw lines for each series
    const curveFactory = getCurveFactory(curve);
    const lineGenerator = d3
      .line<{ timestamp: number; value: number }>()
      .curve(curveFactory)
      .defined((d) => d.value != null && !isNaN(d.value))
      .x((d) => scales.xScale(d.timestamp))
      .y((d) => scales.yScale(d.value));

    data.forEach((series) => {
      if (!series.data || series.data.length === 0) return;

      const lineData = series.data.map((d) => ({
        timestamp: (d as ChartDataPoint).timestamp ?? new Date(d.valueDate).getTime(),
        value: Number(d.value),
      }));

      g.append("path")
        .datum(lineData)
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", series.color)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

      // Add dots for active points (hover state handled by CSS or separate logic)
      g.selectAll(`.dot-${series.id}`)
        .data(lineData)
        .join("circle")
        .attr("class", `dot dot-${series.id}`)
        .attr("cx", (d) => scales.xScale(d.timestamp))
        .attr("cy", (d) => scales.yScale(d.value))
        .attr("r", 0) // Hidden by default, shown on hover
        .attr("fill", series.color)
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("pointer-events", "none");
    });

    // Draw X axis
    const xAxis = d3
      .axisBottom(scales.xScale)
      .tickValues(scales.xScale.domain())
      .tickFormat((value) => {
        const date = new Date(value as number);
        return date.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });
      });

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${dimensions.boundedHeight})`)
      .call(xAxis)
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick line").remove();
        g.selectAll(".tick text").attr("font-size", 10).attr("fill", "#666");
        g.select(".tick:first-child text").attr("text-anchor", "start");
        g.select(".tick:last-child text").attr("text-anchor", "end");
      });

    // Draw Y axis
    const yAxis = d3
      .axisLeft(scales.yScale)
      .ticks(5)
      .tickFormat((value) => `£${numabbr(value as number)}`);

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick line").remove();
        g.selectAll(".tick text").attr("font-size", 10).attr("fill", "#666");
      });

    // Draw tooltip cursor line
    if (tooltipData) {
      const cursorX = tooltipData.x - dimensions.marginLeft;

      g.append("line")
        .attr("class", "tooltip-cursor")
        .attr("x1", cursorX)
        .attr("x2", cursorX)
        .attr("y1", 0)
        .attr("y2", dimensions.boundedHeight)
        .attr("stroke", "#3B82F6")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 3")
        .style("pointer-events", "none");

      // Show dots at tooltip points
      tooltipData.points.forEach((point) => {
        g.append("circle")
          .attr("cx", scales.xScale(point.data.timestamp))
          .attr("cy", scales.yScale(Number(point.data.value)))
          .attr("r", 5)
          .attr("fill", point.color)
          .attr("stroke", "white")
          .attr("stroke-width", 2)
          .style("pointer-events", "none");
      });
    }
  }, [svgRef, data, dimensions, scales, milestones, showMilestones, tooltipData, curve]);
}
