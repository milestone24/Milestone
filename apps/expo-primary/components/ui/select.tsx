import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        className={cn(
          "border border-border bg-background rounded-md px-3 py-2",
          disabled && "opacity-50",
          className
        )}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text className={cn("text-base", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setOpen(false)} />
          <View className="bg-card rounded-t-2xl border border-border max-h-[60%]">
            <View className="px-4 py-3 border-b border-border">
              <Text className="text-lg font-semibold text-foreground">{placeholder}</Text>
            </View>
            <ScrollView className="px-2 py-2">
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  className={cn(
                    "px-3 py-3 rounded-md mb-1",
                    option.value === value ? "bg-muted" : "active:bg-muted/50"
                  )}
                  onPress={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text className="text-foreground text-base">{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View className="p-4 border-t border-border">
              <Button variant="outline" label="Cancel" onPress={() => setOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
