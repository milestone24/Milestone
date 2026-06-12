import { Pressable, Text, View } from "react-native";
import { useDateRange } from "@milestone/js-common/react/context/DateRangeContext";
import type { DateRangeOption } from "@milestone/js-common/react/types/date-range";
import { cn } from "@/lib/cn";

export const DATE_RANGES = [
  { label: "W", value: "week" },
  { label: "1M", value: "1month" },
  { label: "3M", value: "3months" },
  { label: "6M", value: "6months" },
  { label: "1Y", value: "1year" },
  { label: "YTD", value: "ytd" },
  { label: "Max", value: "max" },
] as const;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDateRange(
  range: DateRangeOption
): { start: Date | undefined; end: Date | undefined } {
  const end = startOfDay(new Date());
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
      start = new Date(end.getFullYear(), 0, 1);
      break;
    case "max":
      start = undefined;
      break;
    default:
      start = undefined;
  }

  return { start, end };
}

type DateRangeControlProps = {
  className?: string;
};

export default function DateRangeControl({ className }: DateRangeControlProps) {
  const { dateRange, setDateRange } = useDateRange();

  return (
    <View className={cn("flex-row flex-wrap justify-center gap-2", className)}>
      {DATE_RANGES.map((range) => (
        <Pressable
          key={range.value}
          className={cn(
            "px-3 py-1 rounded-full",
            dateRange === range.value ? "bg-muted" : "bg-transparent"
          )}
          onPress={() => setDateRange(range.value)}
        >
          <Text
            className={cn(
              "text-xs font-medium",
              dateRange === range.value ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {range.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
