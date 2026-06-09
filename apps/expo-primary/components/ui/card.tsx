import { Text, View, type ViewProps, type TextProps } from "react-native";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("rounded-lg border border-border bg-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("px-4 pt-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, children }: TextProps & { className?: string }) {
  return (
    <Text className={cn("text-base font-medium text-foreground", className)}>
      {children}
    </Text>
  );
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("p-4", className)} {...props} />;
}
