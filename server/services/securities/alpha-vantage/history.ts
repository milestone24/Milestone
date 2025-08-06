import { SecurityHistory, IntradayOptions, SecurityIdentifier } from "../types"
import { validateApiKey, validateApiKeyOptional } from "../../../utils/api-key-validation"
import { makeApiRequest } from "../../../utils/http-client"
import { validateAndExtractDateRange, validateAndExtractDateString } from "../../../utils/date-validation"
import { withErrorHandling } from "../../../utils/error-handling"
import { buildAlphaVantageUrl } from "../utils/provider-url-builders"
import { validateAlphaVantageResponse, validateAlphaVantageTimeSeries } from "../utils/provider-response-validation"
import { mapAlphaVantageToSecurityHistory } from "../utils/security-history-mapper"
import { normalizeAlphaVantageSymbolForIntraday } from "../utils/exchange-suffix-mapper"

export type AlphaVantageHistoryResponse = {
  "Meta Data"?: {
    "1. Information": string;
    "2. Symbol": string;
    "3. Last Refreshed": string;
    "4. Output Size": string;
    "5. Time Zone": string;
  };
  "Time Series (Daily)"?: {
    [date: string]: {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    };
  };
  "Note"?: string;
  "Error Message"?: string;
}

export const getSecurityHistoryForDateRange = async (
  symbol: string, 
  startDate: Date, 
  endDate: Date
): Promise<SecurityHistory[]> => {
  const apiKey = validateApiKeyOptional("ALPHA_VANTAGE_API_KEY", "Alpha Vantage")
  if (!apiKey) {
    return []
  }

  try {
    const url = buildAlphaVantageUrl({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "full",
      apikey: apiKey,
      datatype: "json",
    })

    const data: AlphaVantageHistoryResponse = await makeApiRequest(url, "Alpha Vantage")
    validateAlphaVantageResponse(data)

    const timeSeries = validateAlphaVantageTimeSeries(data, "Alpha Vantage API")
    const { startDateStr, endDateStr } = validateAndExtractDateRange(startDate, endDate)

    const results: SecurityHistory[] = []

    for (const [date, values] of Object.entries(timeSeries)) {
      if (date >= startDateStr && date <= endDateStr) {
        results.push(mapAlphaVantageToSecurityHistory(values, date, symbol))
      }
    }

    return results.sort((a, b) => a.date.getTime() - b.date.getTime())

  } catch (error) {
    console.error(`Error fetching Alpha Vantage history for ${symbol}:`, error)
    return []
  }
}

export const getSecurityHistoryForDate = async (
  symbol: string, 
  date: Date
): Promise<SecurityHistory> => {
  const apiKey = validateApiKey("ALPHA_VANTAGE_API_KEY", "Alpha Vantage")

  try {
    const url = buildAlphaVantageUrl({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "compact",
      apikey: apiKey,
      datatype: "json",
    })

    const data: AlphaVantageHistoryResponse = await makeApiRequest(url, "Alpha Vantage")
    console.log("data", data)
    validateAlphaVantageResponse(data)

    const timeSeries = validateAlphaVantageTimeSeries(data, "Alpha Vantage API")
    const dateStr = validateAndExtractDateString(date)
    
    const values = timeSeries[dateStr]

    if (!values) {
      throw new Error(`No history data found for ${symbol} on ${dateStr}`)
    }

    return mapAlphaVantageToSecurityHistory(values, dateStr, symbol)

  } catch (error) {
    console.error(`Error fetching Alpha Vantage history for ${symbol}:`, error)
    throw error
  }
} 

/**
 * Get intraday security history for a specific date
 * @param identifier - The security identifier with symbol and optional exchange
 * @param date - The date to get intraday data for
 * @returns Promise resolving to array of intraday SecurityHistory objects
 */
export const getIntradaySecurityHistoryForDate = async (identifier: SecurityIdentifier, date: Date, options?: IntradayOptions): Promise<SecurityHistory[]> => {
  return withErrorHandling(async () => {
    const apiKey = validateApiKeyOptional('ALPHA_VANTAGE_API_KEY', 'Alpha Vantage')
    if (!apiKey) {
      return []
    }

    const dateStr = validateAndExtractDateString(date)
    
    // For intraday data, we use intervals of 15min or higher
    // Default to 15min if not specified
    const interval = options?.interval || '15min'
    
    // Normalize the symbol for Alpha Vantage API calls
    const normalizedSymbol = normalizeAlphaVantageSymbolForIntraday(identifier.symbol)
    
    const params = {
      function: 'TIME_SERIES_INTRADAY',
      symbol: normalizedSymbol.toUpperCase(),
      interval: interval,
      apikey: apiKey,
      outputsize: 'compact' // Always use compact for efficiency
    }

    const url = buildAlphaVantageUrl(params)
    const data = await makeApiRequest(url, 'Alpha Vantage')
    
    validateAlphaVantageResponse(data)
    
    // Extract the time series data based on interval
    const timeSeriesKey = `Time Series (${interval})`
    const timeSeriesData = validateAlphaVantageTimeSeries(data, timeSeriesKey)
    
    if (!timeSeriesData || typeof timeSeriesData !== 'object') {
      return []
    }

    const intradayHistory: SecurityHistory[] = []
    
    // Filter data for the specific date
    const targetDateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
    
    Object.entries(timeSeriesData).forEach(([timestamp, values]) => {
      // Alpha Vantage intraday timestamps are in format: "2024-01-15 16:00:00"
      const timestampDate = timestamp.split(' ')[0] // Extract date part
      
      if (timestampDate === targetDateStr) {
        const history = mapAlphaVantageToSecurityHistory(values, timestamp, identifier.symbol)
        intradayHistory.push(history)
      }
    })

    // Sort by timestamp (oldest first) and return only data for the requested day
    return intradayHistory.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, `Error getting intraday history for ${identifier.symbol} on ${date instanceof Date && !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : 'invalid-date'}`, [])
} 