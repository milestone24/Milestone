import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/cn";

type InputProps = TextInputProps & { className?: string };

export function Input({ className, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        "border border-border bg-background text-foreground rounded-md px-3 py-2 text-base",
        className
      )}
      placeholderTextColor="#71717a"
      {...props}
    />
  );
}
