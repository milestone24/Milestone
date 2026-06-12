import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { cn } from "@/lib/cn";

type ToastVariant = "default" | "destructive";

export type ToastPayload = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
};

let showToastImpl: ((payload: ToastPayload) => void) | null = null;

export function showToast(payload: ToastPayload) {
  showToastImpl?.(payload);
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    showToastImpl = (payload) => setToast(payload);
    return () => {
      showToastImpl = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toast, opacity]);

  if (!toast) return null;

  return (
    <Animated.View
      style={{ opacity }}
      className="absolute bottom-24 left-4 right-4 z-50"
      pointerEvents="none"
    >
      <View
        className={cn(
          "rounded-lg border px-4 py-3 shadow-lg",
          toast.variant === "destructive"
            ? "border-destructive bg-destructive"
            : "border-border bg-card"
        )}
      >
        {toast.title ? (
          <Text
            className={cn(
              "font-semibold",
              toast.variant === "destructive"
                ? "text-destructive-foreground"
                : "text-foreground"
            )}
          >
            {toast.title}
          </Text>
        ) : null}
        {toast.description ? (
          <Text
            className={cn(
              "text-sm mt-1",
              toast.variant === "destructive"
                ? "text-destructive-foreground"
                : "text-muted-foreground"
            )}
          >
            {toast.description}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
