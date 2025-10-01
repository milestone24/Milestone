import { getDateRange } from "@/components/ui/DateRangeControl";
import { useDateRange } from "@/context/DateRangeContext";
import { useMemo } from "react";

const composeChartDate;

export const useAssetChartDate = (assetId: string | null) => {
  //If not assetId

  const { dateRange } = useDateRange();
  const { start: startDate, end: endDate } = useMemo(() => {
    return getDateRange(dateRange);
  }, [dateRange]);
};
