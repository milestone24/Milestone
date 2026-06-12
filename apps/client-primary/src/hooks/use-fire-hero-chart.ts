import { useEffect, useRef, type RefObject } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "@milestone/js-common/react/chart/types";
import type { FireProjectionData } from "@milestone/js-common/schema/projections";
import {
  useFireHeroChartLegend,
  useFireHeroStackData,
  type FireHeroLegendValues,
} from "@milestone/js-common/react/hooks/use-fire-hero-chart-data";

export type { FireHeroLegendValues };

const ACCOUNT_TYPE_COLOR_VAR: Record<string, string> = {
  ISA: "--color-isa",
  SIPP: "--color-sipp",
  LISA: "--color-lisa",
  GIA: "--color-gia",
  OTHER: "--color-other",
  PENSION: "--color-pension",
};

const FALLBACK_COLOR_VAR = "--color-primary";

const getColorVar = (accountType: string): string =>
  ACCOUNT_TYPE_COLOR_VAR[accountType.toUpperCase()] ?? FALLBACK_COLOR_VAR;

type StackDatum = Record<string, number>;

export type UseFireHeroChartOptions = {
  svgRef: RefObject<SVGSVGElement | null>;
  dimensions: ChartDimensions;
  chartData: Map<string, FireProjectionData[]>;
  fireNumber: number;
  targetRetirementAge: number;
  projectedRetirementAge: number | null;
};

export function useFireHeroChart({
  svgRef,
  dimensions,
  chartData,
  fireNumber,
  targetRetirementAge,
  projectedRetirementAge,
}: UseFireHeroChartOptions): FireHeroLegendValues {
  const { keys, stackData } = useFireHeroStackData(chartData);
  const legendValues = useFireHeroChartLegend(chartData, targetRetirementAge);
  const hasAnimatedOnceRef = useRef(false);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (
      !svgEl ||
      !dimensions.boundedWidth ||
      !dimensions.boundedHeight ||
      stackData.length === 0 ||
      keys.length === 0
    ) {
      return;
    }

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const { marginTop, marginLeft, boundedWidth, boundedHeight } = dimensions;

    const firstDatum = stackData[0]!;
    const lastDatum = stackData[stackData.length - 1]!;

    const stack = d3.stack<StackDatum>().keys(keys);
    const series = stack(stackData);

    const maxY =
      Math.max(
        d3.max(series, (stackSeries) => d3.max(stackSeries, (point) => point[1]) ?? 0) ?? 0,
        fireNumber
      ) * 1.06;

    const xScale = d3
      .scaleLinear()
      .domain([firstDatum["age"]!, lastDatum["age"]!])
      .range([0, boundedWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, maxY])
      .range([boundedHeight, 0]);

    const defs = svg.append("defs");

    for (const key of keys) {
      const colorVar = getColorVar(key);
      const grad = defs
        .append("linearGradient")
        .attr("id", `fhc-grad-${key}`)
        .attr("x1", "0")
        .attr("y1", "0")
        .attr("x2", "0")
        .attr("y2", "1");
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", `var(${colorVar})`)
        .attr("stop-opacity", 0.65);
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", `var(${colorVar})`)
        .attr("stop-opacity", 0.12);
    }

    const clipRect = defs
      .append("clipPath")
      .attr("id", "fhc-clip")
      .append("rect")
      .attr("x", 0)
      .attr("y", -marginTop)
      .attr("width", 0)
      .attr("height", boundedHeight + marginTop);

    const g = svg
      .append("g")
      .attr("transform", `translate(${marginLeft},${marginTop})`);

    const curve = d3.curveCatmullRom.alpha(0.5);

    const area = d3
      .area<d3.SeriesPoint<StackDatum>>()
      .x((point) => xScale(point.data["age"]!))
      .y0((point) => yScale(point[0]))
      .y1((point) => yScale(point[1]))
      .curve(curve);

    const lineGen = d3
      .line<d3.SeriesPoint<StackDatum>>()
      .x((point) => xScale(point.data["age"]!))
      .y((point) => yScale(point[1]))
      .curve(curve);

    const areasGroup = g.append("g").attr("clip-path", "url(#fhc-clip)");
    for (const stackSeries of series) {
      areasGroup
        .append("path")
        .datum(stackSeries)
        .attr("fill", `url(#fhc-grad-${stackSeries.key})`)
        .attr("d", (points) => area(points as d3.SeriesPoint<StackDatum>[]));
    }

    for (const stackSeries of series) {
      const colorVar = getColorVar(stackSeries.key);
      areasGroup
        .append("path")
        .datum(stackSeries)
        .attr("fill", "none")
        .attr("stroke", `var(${colorVar})`)
        .attr("stroke-width", 1.5)
        .attr("d", (points) => lineGen(points as d3.SeriesPoint<StackDatum>[]));
    }

    const targetY = yScale(fireNumber);
    g.append("text")
      .attr("x", 0)
      .attr("y", targetY - 6)
      .attr("fill", "var(--color-muted-foreground)")
      .attr("font-size", "10px")
      .text("FIRE target");
    g.append("line")
      .attr("x1", 0)
      .attr("x2", boundedWidth)
      .attr("y1", targetY)
      .attr("y2", targetY)
      .attr("stroke", "var(--color-muted-foreground)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.6);

    const startTotal = keys.reduce(
      (sum, key) => sum + (firstDatum[key] ?? 0),
      0
    );
    g.append("circle")
      .attr("cx", xScale(firstDatum["age"]!))
      .attr("cy", yScale(startTotal))
      .attr("r", 5)
      .attr("fill", "var(--color-primary)")
      .attr("stroke", "var(--color-card)")
      .attr("stroke-width", 2);

    g.append("g")
      .attr("transform", `translate(0,${boundedHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(4)
          .tickFormat((value) => `Age ${value}`)
      )
      .call((axis) => {
        axis.select(".domain").remove();
        axis.selectAll(".tick line").remove();
        axis
          .selectAll<SVGTextElement, unknown>("text")
          .attr("fill", "var(--color-muted-foreground)")
          .attr("font-size", "11px")
          .attr("text-anchor", "middle");
        axis
          .select<SVGTextElement>(".tick:first-of-type text")
          .attr("text-anchor", "start");
        axis
          .select<SVGTextElement>(".tick:last-of-type text")
          .attr("text-anchor", "end");
      });

    const tooltipGroup = g
      .append("g")
      .attr("opacity", 0)
      .attr("pointer-events", "none");
    const hairline = tooltipGroup
      .append("line")
      .attr("stroke", "var(--color-muted-foreground)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("y1", 0)
      .attr("y2", boundedHeight);

    const tooltipBg = tooltipGroup
      .append("rect")
      .attr("rx", 6)
      .attr("fill", "var(--color-card)")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-width", 1);

    const activeTooltipTexts: d3.Selection<
      SVGTextElement,
      unknown,
      null,
      undefined
    >[] = [];

    const renderTooltip = (datum: StackDatum) => {
      activeTooltipTexts.forEach((textNode) => textNode.remove());
      activeTooltipTexts.length = 0;

      const x = xScale(datum["age"]!);
      hairline.attr("x1", x).attr("x2", x);

      const lines = [
        `Age ${datum["age"]}`,
        ...keys.map((key) => `${key}: £${d3.format(",.0f")(datum[key] ?? 0)}`),
      ];

      const lineH = 16;
      const pad = 8;
      const tooltipW = 130;
      const tooltipH = lines.length * lineH + pad * 2;
      const tooltipX =
        x + 8 + tooltipW > boundedWidth ? x - tooltipW - 8 : x + 8;
      const tooltipY = Math.max(
        0,
        Math.min(boundedHeight / 2 - tooltipH / 2, boundedHeight - tooltipH)
      );

      tooltipBg
        .attr("x", tooltipX)
        .attr("y", tooltipY)
        .attr("width", tooltipW)
        .attr("height", tooltipH);

      lines.forEach((line, index) => {
        const textNode = tooltipGroup
          .append("text")
          .attr("x", tooltipX + pad)
          .attr("y", tooltipY + pad + (index + 0.75) * lineH)
          .attr("font-size", index === 0 ? "12px" : "11px")
          .attr("font-weight", index === 0 ? "600" : "400")
          .attr(
            "fill",
            index === 0
              ? "var(--color-foreground)"
              : "var(--color-muted-foreground)"
          )
          .text(line);
        activeTooltipTexts.push(textNode);
      });

      tooltipGroup.attr("opacity", 1);
    };

    g.append("rect")
      .attr("width", boundedWidth)
      .attr("height", boundedHeight)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event);
        const age = xScale.invert(mx);
        const nearest = stackData.reduce((prev, curr) =>
          Math.abs(curr["age"]! - age) < Math.abs(prev["age"]! - age)
            ? curr
            : prev
        );
        renderTooltip(nearest);
      })
      .on("mouseleave", () => {
        tooltipGroup.attr("opacity", 0);
        activeTooltipTexts.forEach((textNode) => textNode.remove());
        activeTooltipTexts.length = 0;
      });

    if (hasAnimatedOnceRef.current) {
      clipRect.attr("width", boundedWidth);
    } else {
      hasAnimatedOnceRef.current = true;
      clipRect
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attr("width", boundedWidth);
    }
  }, [
    svgRef,
    dimensions,
    stackData,
    keys,
    fireNumber,
    targetRetirementAge,
    projectedRetirementAge,
  ]);

  return legendValues;
}
