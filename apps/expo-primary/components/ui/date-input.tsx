import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/cn";

type DateInputProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value?: Date | null;
  onChange: (date: Date | undefined) => void;
  className?: string;
};

function formatDate(value?: Date | null): string {
  if (!value) return "";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDate(text: string): Date | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function DateInput({ value, onChange, className, ...props }: DateInputProps) {
  return (
    <TextInput
      className={cn(
        "border border-border bg-background text-foreground rounded-md px-3 py-2 text-base",
        className
      )}
      placeholder="DD/MM/YYYY"
      placeholderTextColor="#71717a"
      keyboardType="numbers-and-punctuation"
      value={formatDate(value)}
      onChangeText={(text) => {
        if (!text.trim()) {
          onChange(undefined);
          return;
        }
        const parsed = parseDate(text);
        if (parsed) onChange(parsed);
      }}
      {...props}
    />
  );
}
