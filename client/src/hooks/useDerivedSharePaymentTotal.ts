import { useEffect } from "react";
import { createDecimalValueString, isDecimalValueString, DecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";

export const useDerivedSharePaymentTotal = (
  shares: DecimalValueString | undefined,
  perUnitValue: DecimalValueString | undefined,
  setValue: (value: DecimalValueString) => void
) => {
  useEffect(() => {
    if (!shares || !perUnitValue || !isDecimalValueString(shares) || !isDecimalValueString(perUnitValue)) return;
    setValue(
      createDecimalValueString(
        new Decimal(shares)
          .abs()
          .mul(perUnitValue)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toString(),
      ),
    );
  }, [shares, perUnitValue, setValue]);
};