import { useMemo } from "react";
import type { CombinedDayTimePointBase } from "../../schema";

export type ChartDataItemSuccess = {
  id: string;
  name: string;
  color: string;
  data: CombinedDayTimePointBase[];
  error?: never;
  isLoading?: boolean;
};

export type ChartDataItemError = {
  id: string;
  name: string;
  color: string;
  error: Error;
  data?: never;
  isLoading?: boolean;
};

export type ChartDataItem = ChartDataItemSuccess | ChartDataItemError;

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
      if (!series.data) return;
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
    const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
    const minValue = Math.floor(rawMin / 10000) * 10000;

    return {
      allTimestamps,
      minTimestamp,
      maxTimestamp,
      maxValue,
      minValue,
    };
  }, [data]);
}
