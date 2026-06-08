import { useState, useCallback, RefObject } from "react";
import {
  findDataPointsAtTimestamp,
  timestampFromPointerPosition,
  type SelectedPoint,
} from "@milestone/js-common/react/chart/findDataPointsAtTimestamp";
import type { ChartScales } from "@milestone/js-common/react/hooks/use-chart-scales";
import type { ChartData } from "@milestone/js-common/react/hooks/use-chart-data";

export type { SelectedPoint };

export type TooltipData = {
  x: number;
  y: number;
  points: SelectedPoint[];
} | null;

export type UseChartInteractionsReturn = {
  tooltipData: TooltipData;
  selectedPoints: SelectedPoint[] | null;
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
  const [selectedPoints, setSelectedPoints] = useState<SelectedPoint[] | null>(
    null
  );

  const resolvePointsFromEvent = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return null;

      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left - dimensions.marginLeft;
      const timestamp = timestampFromPointerPosition(mouseX, scales.xScale);
      const points = findDataPointsAtTimestamp(data, timestamp);

      return { svgRect, points };
    },
    [data, dimensions.marginLeft, scales.xScale, svgRef]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const resolved = resolvePointsFromEvent(event);
      if (!resolved) return;

      const { svgRect, points } = resolved;
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
    [resolvePointsFromEvent]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const resolved = resolvePointsFromEvent(event);
      if (!resolved) return;

      if (resolved.points.length > 0) {
        setSelectedPoints(resolved.points);
      }
    },
    [resolvePointsFromEvent]
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
