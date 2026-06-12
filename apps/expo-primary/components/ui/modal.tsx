import { Modal as RNModal, Pressable, ScrollView, Text, View } from "react-native";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

type AppModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  scrollable?: boolean;
};

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  scrollable = true,
}: AppModalProps) {
  const content = scrollable ? (
    <ScrollView className="max-h-[70%]" keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={() => onOpenChange(false)}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={() => onOpenChange(false)} />
        <View className={cn("bg-card rounded-t-2xl border border-border p-4 max-h-[90%]", className)}>
          {title ? <Text className="text-lg font-semibold text-foreground mb-1">{title}</Text> : null}
          {description ? (
            <Text className="text-sm text-muted-foreground mb-4">{description}</Text>
          ) : null}
          {content}
          {showCloseButton ? (
            <Button
              variant="outline"
              label="Close"
              className="mt-4"
              onPress={() => onOpenChange(false)}
            />
          ) : null}
        </View>
      </View>
    </RNModal>
  );
}
