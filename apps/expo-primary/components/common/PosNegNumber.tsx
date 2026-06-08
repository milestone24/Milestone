import { Text } from "react-native";
import { cn } from "@/lib/cn";

type PosNegNumberProps = {
  value: number;
  displayInPercentage?: boolean;
  className?: string;
};

export function PosNegNumber({
  value,
  displayInPercentage = false,
  className,
}: PosNegNumberProps) {
  const isPositive = value >= 0;
  const formatted = displayInPercentage
    ? `${isPositive ? "+" : ""}${value.toFixed(2)}%`
    : `${isPositive ? "+" : "-"}£${Math.abs(value).toLocaleString()}`;

  return (
    <Text
      className={cn(
        "text-sm font-medium",
        isPositive ? "text-positive" : "text-negative",
        className
      )}
    >
      {formatted}
    </Text>
  );
}
