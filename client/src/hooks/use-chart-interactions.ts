import { useState, useCallback, RefObject } from "react";
import * as d3 from "d3";
import type { CombinedDayTimePointBase } from "shared/schema";
import type { ChartScales } from "./use-chart-scales";
import type { ChartDataPoint, ChartData } from "./use-chart-data";

export type TooltipData = {
  x: number;
  y: number;
  points: Array<{
    seriesName: string;
    color: string;
    data: ChartDataPoint;
  }>;
} | null;

export type UseChartInteractionsReturn = {
  tooltipData: TooltipData;
  selectedPoints: CombinedDayTimePointBase[] | null;
  handleMouseMove: (event: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseLeave: () => void;
  handleClick: (event: React.MouseEvent<SVGSVGElement>) => void;
  clearSelectedPoints: () => void;
};

export function useChartInteractions(
  svgRef: RefObject<SVGSVGElement>,
  data: ChartData,
  scales: ChartScales,
  dimensions: { marginLeft: number; marginTop: number }
): UseChartInteractionsReturn {
  const [tooltipData, setTooltipData] = useState<TooltipData>(null);
  const [selectedPoints, setSelectedPoints] = useState<CombinedDayTimePointBase[] | null>(null);

  const findDataPointsAtTimestamp = useCallback(
    (timestamp: number) => {
      const points: Array<{
        seriesName: string;
        color: string;
        data: ChartDataPoint;
      }> = [];

      data.forEach((series) => {
        // Convert data to include timestamp
        const seriesData = series.data.map(d => ({
          ...d,
          timestamp: (d as ChartDataPoint).timestamp ?? new Date(d.valueDate).getTime()
        })) as ChartDataPoint[];

        // Find exact match or closest point
        const bisector = d3.bisector<ChartDataPoint, number>(
          (d) => d.timestamp
        ).left;
        const index = bisector(seriesData, timestamp);

        let closestPoint: ChartDataPoint | null = null;
        let minDistance = Infinity;

        // Check point at index and adjacent points
        [index - 1, index, index + 1].forEach((i) => {
          if (i >= 0 && i < seriesData.length) {
            const point = seriesData[i];
            if (point) {
              const distance = Math.abs(point.timestamp - timestamp);
              if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
              }
            }
          }
        });

        if (closestPoint && minDistance < 86400000) {
          // Within 1 day (in ms)
          points.push({
            seriesName: series.name,
            color: series.color,
            data: closestPoint,
          });
        }
      });

      return points;
    },
    [data]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left - dimensions.marginLeft;
      const mouseY = event.clientY - svgRect.top - dimensions.marginTop;

      // Get timestamp from mouse position
      const timestamp = scales.xScale.invert(mouseX);
      const points = findDataPointsAtTimestamp(timestamp);

      if (points.length > 0) {
        setTooltipData({
          x: event.clientX - svgRect.left,
          y: event.clientY - svgRect.top,
          points,
        });
      } else {
        setTooltipData(null);
      }
    },
    [svgRef, scales, dimensions, findDataPointsAtTimestamp]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left - dimensions.marginLeft;

      const timestamp = scales.xScale.invert(mouseX);
      const points = findDataPointsAtTimestamp(timestamp);

      if (points.length > 0) {
        setSelectedPoints(points.map((p) => p.data));
      }
    },
    [svgRef, scales, dimensions, findDataPointsAtTimestamp]
  );

  const clearSelectedPoints = useCallback(() => {
    setSelectedPoints(null);
  }, []);

  return {
    tooltipData,
    selectedPoints,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    clearSelectedPoints,
  };
}
