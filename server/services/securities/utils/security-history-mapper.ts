import { createDecimalValueString } from "@shared/schema";
import { ALPHA_VANTAGE_SOURCE_IDENTIFIER } from "../alpha-vantage/const";
import { EODHD_SOURCE_IDENTIFIER } from "../eodhd/const";
import { SecurityHistory } from "../types";
import Decimal from "decimal.js";

export type EODHDHistoryResponse = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
};

export type AlphaVantageHistoryValues = {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
};

/**
 * Maps EODHD history response to SecurityHistory type
 * @param item The EODHD history response item
 * @param symbol The security symbol
 * @returns SecurityHistory object
 */
export const mapEodhdToSecurityHistory = (
  item: EODHDHistoryResponse,
  symbol: string
): SecurityHistory => ({
  symbol,
  exchange: EODHD_SOURCE_IDENTIFIER,
  date: new Date(item.date),
  open: createDecimalValueString(Decimal(item.open).toString()),
  high: createDecimalValueString(Decimal(item.high).toString()),
  low: createDecimalValueString(Decimal(item.low).toString()),
  close: createDecimalValueString(Decimal(item.close).toString()),
  sourceIdentifier: EODHD_SOURCE_IDENTIFIER,
});

/**
 * Maps Alpha Vantage history values to SecurityHistory type
 * @param values The Alpha Vantage history values
 * @param date The date string
 * @param symbol The security symbol
 * @returns SecurityHistory object
 */
export const mapAlphaVantageToSecurityHistory = (
  values: any,
  date: string,
  symbol: string
): SecurityHistory => {
  // Handle Alpha Vantage timestamps which are in US/Eastern time
  // Format: "2024-01-15 09:30:00" or "2024-01-15"
  let parsedDate: Date;

  if (date.includes(" ")) {
    // Intraday timestamp: "2024-01-15 09:30:00" - treat as US/Eastern
    const [datePart, timePart] = date.split(" ");
    parsedDate = new Date(`${datePart}T${timePart}-05:00`); // US/Eastern timezone
  } else {
    // Daily timestamp: "2024-01-15" - treat as UTC
    parsedDate = new Date(date);
  }

  return {
    symbol,
    exchange: ALPHA_VANTAGE_SOURCE_IDENTIFIER,
    date: parsedDate,
    open: createDecimalValueString(
      Decimal(parseFloat(values["1. open"])).toString()
    ),
    high: createDecimalValueString(
      Decimal(parseFloat(values["2. high"])).toString()
    ),
    low: createDecimalValueString(
      Decimal(parseFloat(values["3. low"])).toString()
    ),
    close: createDecimalValueString(
      Decimal(parseFloat(values["4. close"])).toString()
    ),
    sourceIdentifier: ALPHA_VANTAGE_SOURCE_IDENTIFIER,
  };
};
