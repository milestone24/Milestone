import { SecurityHistory } from "../types"

export type EODHDHistoryResponse = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export type AlphaVantageHistoryValues = {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
}

/**
 * Maps EODHD history response to SecurityHistory type
 * @param item The EODHD history response item
 * @param symbol The security symbol
 * @returns SecurityHistory object
 */
export const mapEodhdToSecurityHistory = (item: EODHDHistoryResponse, symbol: string): SecurityHistory => ({
  symbol,
  date: new Date(item.date),
  open: item.open,
  high: item.high,
  low: item.low,
  close: item.close,
})

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
  let parsedDate: Date
  
  if (date.includes(' ')) {
    // Intraday timestamp: "2024-01-15 09:30:00" - treat as US/Eastern
    const [datePart, timePart] = date.split(' ')
    parsedDate = new Date(`${datePart}T${timePart}-05:00`) // US/Eastern timezone
  } else {
    // Daily timestamp: "2024-01-15" - treat as UTC
    parsedDate = new Date(date)
  }
  
  return {
    symbol,
    date: parsedDate,
    open: parseFloat(values["1. open"]),
    high: parseFloat(values["2. high"]),
    low: parseFloat(values["3. low"]),
    close: parseFloat(values["4. close"]),
  }
} 