import React from "react";
import Decimal from "decimal.js";
import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";
import type { DecimalValueString } from "@milestone/js-common/schema/decimal-value";

export type DecimalInputProps = {
  value: string | undefined;
  /**
   * Receives a DecimalValueString on every user keystroke.
   * Intermediate states (e.g. "100.") are passed through as a safe cast —
   * Zod validates the final value on submit, not during typing.
   */
  onChange: (value: DecimalValueString) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Maximum number of decimal places allowed.
   * 2 = currency amounts, 4 = share price (perUnitValue), 8 = share quantity
   */
  decimalScale: number;
  allowNegative?: boolean;
};

/**
 * Strips trailing decimal zeros from a string value using Decimal.js.
 * Safe for very small share quantities where parseFloat().toString()
 * would produce scientific notation (e.g. "0.00000001").
 * Returns the original value unchanged if it cannot be parsed.
 */
const normalizeValue = (value: string | undefined): string | undefined => {
  if (!value || value === "" || value === "-") return value;
  try {
    return new Decimal(value).toString();
  } catch {
    return value;
  }
};

/**
 * A controlled decimal input for react-hook-form financial fields.
 *
 * Wraps NumericFormat with a react-hook-form-compatible onChange interface.
 * - Normalizes display: strips trailing zeros from incoming DB values
 * - Restricts typing: rejects keystrokes beyond decimalScale decimal places
 * - Forwards ref to the underlying input for RHF focus-on-error behaviour
 */
export const DecimalInput = React.forwardRef<
  HTMLInputElement,
  DecimalInputProps
>(({ onChange, allowNegative = false, ...props }, ref) => (
  <NumericFormat
    customInput={Input}
    getInputRef={ref}
      onValueChange={({ value }, sourceInfo) => {
        if (sourceInfo.source !== "event") return;
        onChange(value as DecimalValueString);
      }}
    allowNegative={allowNegative}
    fixedDecimalScale={false}
    thousandSeparator={false}
    {...props}
    value={normalizeValue(props.value)}
  />
));

DecimalInput.displayName = "DecimalInput";
