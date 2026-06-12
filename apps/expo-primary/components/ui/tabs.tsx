import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/cn";

type TabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
};

export function Tabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: TabsProps<T>) {
  return (
    <View className={cn("flex-row rounded-md border border-border bg-muted p-1", className)}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          className={cn(
            "flex-1 py-2 rounded-md items-center",
            value === option.value && "bg-background"
          )}
          onPress={() => onValueChange(option.value)}
        >
          <Text
            className={cn(
              "text-sm font-medium",
              value === option.value ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
