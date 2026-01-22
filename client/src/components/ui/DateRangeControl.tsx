import React from "react";
import { cn } from "@/lib/utils";
import { useDateRange } from "@/context/DateRangeContext";

export const DATE_RANGES = [
  { label: "W", value: "week" },
  { label: "1M", value: "1month" },
  { label: "3M", value: "3months" },
  { label: "6M", value: "6months" },
  { label: "1Y", value: "1year" },
  { label: "YTD", value: "ytd" },
  { label: "Max", value: "max" },
];

export type DateRangeOption =
  | "week"
  | "1month"
  | "3months"
  | "6months"
  | "1year"
  | "ytd"
  | "max";

interface DateRangeControlProps {
  className?: string;
}

export default function DateRangeControl({ className }: DateRangeControlProps) {
  const { dateRange, setDateRange } = useDateRange();

  return (
    <div
      className={cn("flex justify-center items-center space-x-2", className)}
    >
      {DATE_RANGES.map((range) => (
        <button
          key={range.value}
          className={cn(
            "date-range-btn text-xs font-medium py-1 px-3 rounded-full transition-all",
            dateRange === range.value
              ? "bg-gray-200 text-gray-900 font-semibold"
              : "text-gray-600 hover:bg-gray-100"
          )}
          onClick={() => setDateRange(range.value as DateRangeOption)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

export const getDateRange = (
  range: DateRangeOption
): { start: Date | undefined; end: Date | undefined } => {
  const end = new Date();
  let start: Date | undefined;

  switch (range) {
    case "week":
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1month":
      start = new Date(end);
      start.setMonth(end.getMonth() - 1);
      break;
    case "3months":
      start = new Date(end);
      start.setMonth(end.getMonth() - 3);
      break;
    case "6months":
      start = new Date(end);
      start.setMonth(end.getMonth() - 6);
      break;
    case "1year":
      start = new Date(end);
      start.setFullYear(end.getFullYear() - 1);
      break;
    case "ytd":
      start = new Date(end.getFullYear(), 0, 1); // January 1st of current year
      break;
    case "max":
      //TODO: This should be the earliest date of the assets in the database
      start = undefined;
      break;
    default:
      start = new Date(end);
      start.setMonth(end.getMonth() - 6); // Default to 6 months
  }

  return { start, end };
};