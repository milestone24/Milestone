import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("rounded-lg border border-border bg-card", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("p-4", className)} {...props} />;
}
