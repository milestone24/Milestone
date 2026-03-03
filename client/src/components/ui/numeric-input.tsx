import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumericInputProps = {
  value: string | number | undefined;
  onValueChange: (value: string) => void;
  decimalScale?: number;
  allowNegative?: boolean;
  thousandSeparator?: string | boolean;
  className?: string;
};

export function NumericInput({
  value,
  onValueChange,
  decimalScale,
  allowNegative = false,
  thousandSeparator = ",",
  className,
}: NumericInputProps) {
  return (
    <NumericFormat
      customInput={Input}
      value={value}
      onValueChange={({ value: raw }) => onValueChange(raw)}
      decimalScale={decimalScale}
      fixedDecimalScale={false}
      allowNegative={allowNegative}
      thousandSeparator={thousandSeparator}
      className={cn(className)}
    />
  );
}
