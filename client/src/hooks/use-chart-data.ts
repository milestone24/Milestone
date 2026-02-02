import { useMemo } from "react";
import type { CombinedDayTimePointBase } from "shared/schema";

export type ChartDataItem = {
  id: string;
  name: string;
  data: CombinedDayTimePointBase[];
  color: string;
};

export type ChartData = ChartDataItem[];

export type ChartDataPoint = CombinedDayTimePointBase & {
  timestamp: number;
};

export type ProcessedChartData = {
  allTimestamps: number[];
  minTimestamp: number;
  maxTimestamp: number;
  maxValue: number;
  minValue: number;
};

export function useChartData(data: ChartData): ProcessedChartData {
  return useMemo(() => {
    // Collect all unique timestamps from all series
    const timestampSet = new Set<number>();
    const allValues: number[] = [];

    data.forEach((series) => {
      series.data.forEach((point) => {
        // Compute timestamp if not present
        const timestamp = (point as ChartDataPoint).timestamp ??
          new Date(point.valueDate).getTime();
        timestampSet.add(timestamp);
        allValues.push(Number(point.value));
      });
    });

    const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

    const minTimestamp = allTimestamps[0] || 0;
    const maxTimestamp = allTimestamps[allTimestamps.length - 1] || 0;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
    const minValue = 0; // Always start Y axis at 0 per original chart

    return {
      allTimestamps,
      minTimestamp,
      maxTimestamp,
      maxValue,
      minValue,
    };
  }, [data]);
}
