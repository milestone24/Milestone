import { useEffect, RefObject } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "./use-chart-dimensions";
import type { FireChartScales } from "./use-fire-chart-scales";
import type { ProcessedFireChartData } from "./use-fire-chart-data";

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

type UseFireChartRenderOptions = {
  svgRef: RefObject<SVGSVGElement>;
  dimensions: ChartDimensions;
  scales: FireChartScales;
  processedData: ProcessedFireChartData;
  showAccessibleValue: boolean;
  targetRetirementAge: number;
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
  if (value >= 1000000) {
    return `£${(value / 1000000).toFixed(1)}M`;
  } else {
    return `£${(value / 1000).toFixed(0)}k`;
  }
};

export function useFireChartRender({
  svgRef,
  dimensions,
  scales,
  processedData,
  showAccessibleValue,
  targetRetirementAge,
  curve = "monotoneX",
}: UseFireChartRenderOptions) {
  useEffect(() => {
    if (!svgRef.current) return;
    if (dimensions.boundedWidth <= 0 || dimensions.boundedHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${dimensions.marginLeft},${dimensions.marginTop})`);

    const { chartData, retirementPoint, xAxisTicks } = processedData;
    const retirementAge = retirementPoint?.age || processedData.maxAge;

    // Draw reference area (retirement phase)
    g.append("rect")
      .attr("x", scales.xScale(retirementAge))
      .attr("y", 0)
      .attr("width", scales.xScale(processedData.maxAge) - scales.xScale(retirementAge))
      .attr("height", dimensions.boundedHeight)
      .attr("fill", "#f2f9ff")
      .attr("opacity", 0.9);

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

    // Portfolio line (filtered to retirement age)
    const portfolioData = chartData.filter((d) => d.age <= retirementAge);
    const portfolioLine = d3
      .line<typeof portfolioData[0]>()
      .curve(curveFactory)
      .defined((d) => d.portfolio != null && !isNaN(d.portfolio))
      .x((d) => scales.xScale(d.age))
      .y((d) => scales.yScale(d.portfolio));

    g.append("path")
      .datum(portfolioData)
      .attr("class", "line-portfolio")
      .attr("fill", "none")
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 2)
      .attr("d", portfolioLine);

    // Target line (full data)
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
      .attr("stroke", "#F59E0B")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5 5")
      .attr("d", targetLine);

    // Accessible value line (conditional, filtered to retirement age)
    if (showAccessibleValue && processedData.hasAccessibleValue) {
      const accessibleData = chartData.filter(
        (d) => d.age <= retirementAge && d.accessibleValue != null
      );
      const accessibleLine = d3
        .line<typeof accessibleData[0]>()
        .curve(curveFactory)
        .defined((d) => d.accessibleValue != null && !isNaN(d.accessibleValue))
        .x((d) => scales.xScale(d.age))
        .y((d) => scales.yScale(d.accessibleValue!));

      g.append("path")
        .datum(accessibleData)
        .attr("class", "line-accessible")
        .attr("fill", "none")
        .attr("stroke", "#10b981")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "3 3")
        .attr("d", accessibleLine);
    }

    // Draw vertical reference line for retirement
    const retirementX = scales.xScale(retirementAge);
    g.append("line")
      .attr("x1", retirementX)
      .attr("x2", retirementX)
      .attr("y1", 0)
      .attr("y2", dimensions.boundedHeight)
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3 3");

    // Label for retirement line
    g.append("text")
      .attr("x", retirementX)
      .attr("y", -5)
      .attr("fill", "#10b981")
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .text(
        targetRetirementAge
          ? `Retirement at ${retirementAge}`
          : `FIRE at ${retirementAge}`
      );

    // Draw retirement marker dot
    if (retirementPoint) {
      g.append("circle")
        .attr("cx", scales.xScale(retirementPoint.age))
        .attr("cy", scales.yScale(retirementPoint.portfolio))
        .attr("r", 8)
        .attr("fill", "#10b981")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);
    }

    // Draw X axis
    const xAxis = d3
      .axisBottom(scales.xScale)
      .tickValues(xAxisTicks)
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
  }, [
    svgRef,
    dimensions,
    scales,
    processedData,
    showAccessibleValue,
    targetRetirementAge,
    curve,
  ]);
}
