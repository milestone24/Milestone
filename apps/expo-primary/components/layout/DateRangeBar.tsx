import { View } from "react-native";
import DateRangeControl from "@/components/ui/DateRangeControl";
import { cn } from "@/lib/cn";

type DateRangeBarProps = {
  className?: string;
};

export default function DateRangeBar({ className }: DateRangeBarProps) {
  return (
    <View className={cn("flex justify-center px-2", className)}>
      <DateRangeControl />
    </View>
  );
}
