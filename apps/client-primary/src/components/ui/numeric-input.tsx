import React from "react";
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

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onValueChange,
      decimalScale,
      allowNegative = false,
      thousandSeparator = ",",
      className,
    },
    ref
  ) => (
    <NumericFormat
      customInput={Input}
      getInputRef={ref}
      value={value}
      onValueChange={({ value: raw }) => onValueChange(raw)}
      decimalScale={decimalScale}
      fixedDecimalScale={false}
      allowNegative={allowNegative}
      thousandSeparator={thousandSeparator}
      className={cn(className)}
    />
  )
);

NumericInput.displayName = "NumericInput";
