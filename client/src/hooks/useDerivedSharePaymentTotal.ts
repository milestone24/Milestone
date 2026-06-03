import { useEffect, useRef } from "react";
import { createDecimalValueString, isDecimalValueString, DecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";

export const useDerivedSharePaymentTotal = (
  shares: DecimalValueString | undefined,
  perUnitValue: DecimalValueString | undefined,
  setValue: (value: DecimalValueString) => void,
  fees?: DecimalValueString,
  taxes?: DecimalValueString,
) => {
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  useEffect(() => {
    if (!shares || !perUnitValue || !isDecimalValueString(shares) || !isDecimalValueString(perUnitValue)) return;

    if (fees !== undefined && !isDecimalValueString(fees)) return;
    if (taxes !== undefined && !isDecimalValueString(taxes)) return;

    const feesValue = fees ? new Decimal(fees) : new Decimal(0);
    const taxesValue = taxes ? new Decimal(taxes) : new Decimal(0);

    setValueRef.current(
      createDecimalValueString(
        new Decimal(shares)
          .abs()
          .mul(perUnitValue)
          .plus(feesValue)
          .plus(taxesValue)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toString(),
      ),
    );
  }, [shares, perUnitValue, fees, taxes]);
};