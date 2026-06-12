import * as d3 from "d3";
import type { ChartData, ChartDataPoint } from "../hooks/use-chart-data";

export type SelectedPoint = {
  seriesName: string;
  color: string;
  data: ChartDataPoint;
};

export function findDataPointsAtTimestamp(
  data: ChartData,
  timestamp: number
): SelectedPoint[] {
  const points: SelectedPoint[] = [];

  data.forEach((series) => {
    if (!series.data) return;

    const seriesData = series.data.map((point) => ({
      ...point,
      timestamp:
        (point as ChartDataPoint).timestamp ??
        new Date(point.valueDate).getTime(),
    })) as ChartDataPoint[];

    const bisector = d3.bisector<ChartDataPoint, number>(
      (point) => point.timestamp
    ).left;
    const index = bisector(seriesData, timestamp);

    let closestPoint: ChartDataPoint | null = null;
    let minDistance = Infinity;

    [index - 1, index, index + 1].forEach((candidateIndex) => {
      if (candidateIndex >= 0 && candidateIndex < seriesData.length) {
        const point = seriesData[candidateIndex];
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
      points.push({
        seriesName: series.name,
        color: series.color,
        data: closestPoint,
      });
    }
  });

  return points;
}

export function timestampFromPointerPosition(
  mouseX: number,
  xScale: d3.ScaleLinear<number, number>
): number {
  return xScale.invert(mouseX);
}
