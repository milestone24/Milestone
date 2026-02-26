import { useEffect, useMemo, RefObject } from "react";
import * as d3 from "d3";
import type { ChartDimensions } from "./use-chart-dimensions";
import type { FireProjectionData } from "@shared/schema/projections";
import Decimal from "decimal.js";

// Maps account type to its CSS token name
const ACCOUNT_TYPE_COLOR_VAR: Record<string, string> = {
  ISA: "--color-isa",
  SIPP: "--color-sipp",
  LISA: "--color-lisa",
  GIA: "--color-gia",
  OTHER: "--color-other",
  PENSION: "--color-sipp",
};

const FALLBACK_COLOR_VAR = "--color-primary";

const getColorVar = (accountType: string): string =>
  ACCOUNT_TYPE_COLOR_VAR[accountType.toUpperCase()] ?? FALLBACK_COLOR_VAR;

// Unified per-age datum used by d3.stack
type StackDatum = Record<string, number>;

function buildStackData(
  chartData: Map<string, FireProjectionData[]>,
  keys: string[]
): StackDatum[] {
  const ageSet = new Set<number>();
  for (const series of chartData.values()) {
    for (const p of series) ageSet.add(p.age);
  }

  const ages = [...ageSet].sort((a, b) => a - b);

  const seriesMaps = new Map<string, Map<number, number>>();
  for (const [key, series] of chartData) {
    const m = new Map<number, number>();
    for (const p of series) m.set(p.age, Decimal(p.portfolio).toNumber());
    seriesMaps.set(key, m);
  }

  return ages.map(age => {
    const d: StackDatum = { age };
    for (const key of keys) {
      d[key] = seriesMaps.get(key)?.get(age) ?? 0;
    }
    return d;
  });
}

export type FireHeroLegendValues = {
  perType: Map<string, number>;
  total: number;
};

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
  const keys = useMemo(() => [...chartData.keys()], [chartData]);
  const stackData = useMemo(() => buildStackData(chartData, keys), [chartData, keys]);

  const legendValues = useMemo<FireHeroLegendValues>(() => {
    const target =
      stackData.find(d => d["age"] === targetRetirementAge) ??
      stackData[stackData.length - 1];

    if (!target) return { perType: new Map(), total: 0 };

    const perType = new Map<string, number>();
    let total = 0;
    for (const key of keys) {
      const val = target[key] ?? 0;
      perType.set(key, val);
      total += val;
    }
    return { perType, total };
  }, [stackData, keys, targetRetirementAge]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (
      !svgEl ||
      !dimensions.boundedWidth ||
      !dimensions.boundedHeight ||
      stackData.length === 0 ||
      keys.length === 0
    ) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const { marginTop, marginLeft, boundedWidth, boundedHeight } = dimensions;

    const firstDatum = stackData[0]!;
    const lastDatum = stackData[stackData.length - 1]!;

    // Stack generator
    const stack = d3.stack<StackDatum>().keys(keys);
    const series = stack(stackData);

    const maxY =
      Math.max(
        d3.max(series, s => d3.max(s, d => d[1]) ?? 0) ?? 0,
        fireNumber
      ) * 1.06;

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([firstDatum["age"]!, lastDatum["age"]!])
      .range([0, boundedWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, maxY])
      .range([boundedHeight, 0]);

    // Defs
    const defs = svg.append("defs");

    // Per-series linear gradients
    for (const key of keys) {
      const colorVar = getColorVar(key);
      const grad = defs
        .append("linearGradient")
        .attr("id", `fhc-grad-${key}`)
        .attr("x1", "0").attr("y1", "0")
        .attr("x2", "0").attr("y2", "1");
      grad.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", `var(${colorVar})`)
        .attr("stop-opacity", 0.75);
      grad.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", `var(${colorVar})`)
        .attr("stop-opacity", 0.2);
    }

    // Clip-path for enter animation
    const clipRect = defs
      .append("clipPath")
      .attr("id", "fhc-clip")
      .append("rect")
      .attr("x", 0).attr("y", -marginTop)
      .attr("width", 0)
      .attr("height", boundedHeight + marginTop);

    // Chart group
    const g = svg.append("g").attr("transform", `translate(${marginLeft},${marginTop})`);

    // Area generator
    const area = d3
      .area<d3.SeriesPoint<StackDatum>>()
      .x(d => xScale(d.data["age"]!))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // Stacked areas inside clip group
    const areasGroup = g.append("g").attr("clip-path", "url(#fhc-clip)");
    for (const s of series) {
      areasGroup
        .append("path")
        .datum(s)
        .attr("fill", `url(#fhc-grad-${s.key})`)
        .attr("d", d => area(d as d3.SeriesPoint<StackDatum>[]));
    }

    // FIRE target dashed line
    const targetY = yScale(fireNumber);
    g.append("line")
      .attr("x1", 0).attr("x2", boundedWidth)
      .attr("y1", targetY).attr("y2", targetY)
      .attr("stroke", "var(--color-primary)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.7);

    // Crossover point — first age where stacked total >= fireNumber
    const crossoverDatum = stackData.find(d =>
      keys.reduce((sum, k) => sum + (d[k] ?? 0), 0) >= fireNumber
    );

    if (crossoverDatum) {
      const cx = xScale(crossoverDatum["age"]!);
      const cy = yScale(fireNumber);
      const pillW = 36;
      const pillH = 20;
      const pillX = Math.min(Math.max(cx - pillW / 2, 0), boundedWidth - pillW);
      const pillY = cy - pillH - 8;

      g.append("circle")
        .attr("cx", cx).attr("cy", cy).attr("r", 5)
        .attr("fill", "var(--color-primary)")
        .attr("stroke", "var(--color-card)").attr("stroke-width", 2);

      g.append("rect")
        .attr("x", pillX).attr("y", pillY)
        .attr("width", pillW).attr("height", pillH)
        .attr("rx", pillH / 2)
        .attr("fill", "var(--color-primary)");

      g.append("text")
        .attr("x", pillX + pillW / 2).attr("y", pillY + pillH / 2)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("fill", "var(--color-primary-foreground)")
        .attr("font-size", "11px").attr("font-weight", "600")
        .text(`${crossoverDatum["age"]}`);
    }

    // X-axis
    g.append("g")
      .attr("transform", `translate(0,${boundedHeight})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(6)
          .tickFormat(d => `${d}`)
      )
      .call(ax => {
        ax.select(".domain").remove();
        ax.selectAll(".tick line").remove();
        ax.selectAll("text")
          .attr("fill", "var(--color-muted-foreground)")
          .attr("font-size", "11px");
      });

    // Hover tooltip
    const tooltipGroup = g.append("g").attr("opacity", 0).attr("pointer-events", "none");
    const hairline = tooltipGroup
      .append("line")
      .attr("stroke", "var(--color-muted-foreground)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("y1", 0).attr("y2", boundedHeight);

    const tooltipBg = tooltipGroup.append("rect")
      .attr("rx", 6).attr("fill", "var(--color-card)")
      .attr("stroke", "var(--color-border)").attr("stroke-width", 1);

    const activeTooltipTexts: d3.Selection<SVGTextElement, unknown, null, undefined>[] = [];

    const renderTooltip = (datum: StackDatum) => {
      activeTooltipTexts.forEach(t => t.remove());
      activeTooltipTexts.length = 0;

      const x = xScale(datum["age"]!);
      hairline.attr("x1", x).attr("x2", x);

      const lines = [
        `Age ${datum["age"]}`,
        ...keys.map(k => `${k}: £${d3.format(",.0f")(datum[k] ?? 0)}`),
      ];

      const lineH = 16;
      const pad = 8;
      const tooltipW = 130;
      const tooltipH = lines.length * lineH + pad * 2;
      const tooltipX = x + 8 + tooltipW > boundedWidth ? x - tooltipW - 8 : x + 8;
      const tooltipY = Math.max(0, Math.min(boundedHeight / 2 - tooltipH / 2, boundedHeight - tooltipH));

      tooltipBg
        .attr("x", tooltipX).attr("y", tooltipY)
        .attr("width", tooltipW).attr("height", tooltipH);

      lines.forEach((line, i) => {
        const t = tooltipGroup
          .append("text")
          .attr("x", tooltipX + pad)
          .attr("y", tooltipY + pad + (i + 0.75) * lineH)
          .attr("font-size", i === 0 ? "12px" : "11px")
          .attr("font-weight", i === 0 ? "600" : "400")
          .attr("fill", i === 0 ? "var(--color-foreground)" : "var(--color-muted-foreground)")
          .text(line);
        activeTooltipTexts.push(t);
      });

      tooltipGroup.attr("opacity", 1);
    };

    g.append("rect")
      .attr("width", boundedWidth).attr("height", boundedHeight)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event);
        const age = xScale.invert(mx);
        const nearest = stackData.reduce((prev, curr) =>
          Math.abs(curr["age"]! - age) < Math.abs(prev["age"]! - age) ? curr : prev
        );
        renderTooltip(nearest);
      })
      .on("mouseleave", () => {
        tooltipGroup.attr("opacity", 0);
        activeTooltipTexts.forEach(t => t.remove());
        activeTooltipTexts.length = 0;
      });

    // Enter animation
    clipRect
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr("width", boundedWidth);

  }, [svgRef, dimensions, stackData, keys, fireNumber, targetRetirementAge, projectedRetirementAge]);

  return legendValues;
}
