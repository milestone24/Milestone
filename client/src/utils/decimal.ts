import { DecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";


export const formatCurrencyDecimal = (value: DecimalValueString) => {
  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Decimal(value).toNumber());
};


export const formatShareQuantityDecimal = (value: DecimalValueString) => {
  return Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 8,
    minimumFractionDigits: 8,
  }).format(Decimal(value).toNumber());
};

export const formatShareValueDecimal = (value: DecimalValueString) => {
  return Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  }).format(Decimal(value).toNumber());
};