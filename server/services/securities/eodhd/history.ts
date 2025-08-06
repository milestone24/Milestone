import { SecurityHistory, IntradayOptions, SecurityIdentifier } from "../types"
import { validateApiKey, validateApiKeyOptional } from "../../../utils/api-key-validation"
import { makeApiRequest } from "../../../utils/http-client"
import { validateAndExtractDateRange, validateAndExtractDateString } from "../../../utils/date-validation"
import { withErrorHandling } from "../../../utils/error-handling"
import { validateArrayResponse } from "../../../utils/response-validation"
import { buildEodhdEodUrl } from "../utils/provider-url-builders"
import { mapEodhdToSecurityHistory } from "../utils/security-history-mapper"

export type EODHDHistoryResponse = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export type EODHDIntradayResponse = {
  datetime: string;
  gmtoffset: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const getSecurityHistoryForDateRange = async (
  identifier: SecurityIdentifier, 
  startDate: Date, 
  endDate: Date
): Promise<SecurityHistory[]> => {
  const apiKey = validateApiKeyOptional("EODHD_API_KEY", "EODHD")
  if (!apiKey) {
    return []
  }

  try {
    const { startDateStr, endDateStr } = validateAndExtractDateRange(startDate, endDate)
    const url = buildEodhdEodUrl(identifier, apiKey, startDateStr, endDateStr)
    
    const data: EODHDHistoryResponse[] = await makeApiRequest(url, "EODHD")
    const arrayData = validateArrayResponse(data, "EODHD API") as EODHDHistoryResponse[]

    return arrayData.map((item): SecurityHistory => mapEodhdToSecurityHistory(item, identifier.symbol))

  } catch (error) {
    console.error(`Error fetching EODHD history for ${identifier.symbol}:`, error)
    return []
  }
}

export const getSecurityHistoryLiveForDateRange = async (
  identifier: SecurityIdentifier, 
  startDate: Date, 
  endDate: Date
): Promise<SecurityHistory[]> => {
  const apiKey = validateApiKeyOptional("EODHD_API_KEY", "EODHD")
  if (!apiKey) {
    return []
  }

  try {
    const { startDateStr, endDateStr } = validateAndExtractDateRange(startDate, endDate)
    //const url = buildEodhdEodUrl(identifier, apiKey, startDateStr, endDateStr)

    const url = `https://eodhd.com/api/real-time/${identifier.symbol}.${identifier.exchange}?api_token=${apiKey}&fmt=json`
    
    const data: EODHDHistoryResponse[] = await makeApiRequest(url, "EODHD")


    console.log("DATA", data)

    const arrayData = validateArrayResponse(data, "EODHD API") as EODHDHistoryResponse[]

    return arrayData.map((item): SecurityHistory => mapEodhdToSecurityHistory(item, identifier.symbol))

  } catch (error) {
    console.error(`Error fetching EODHD history for ${identifier.symbol}:`, error)
    return []
  }
}

export const getSecurityHistoryForDate = async (
  identifier: SecurityIdentifier, 
  date: Date
): Promise<SecurityHistory> => {
  const apiKey = validateApiKey("EODHD_API_KEY", "EODHD")

  try {
    const dateStr = validateAndExtractDateString(date)
    const url = buildEodhdEodUrl(identifier, apiKey, dateStr, dateStr)
    
    const data: EODHDHistoryResponse[] = await makeApiRequest(url, "EODHD")
    const arrayData = validateArrayResponse(data, "EODHD API") as EODHDHistoryResponse[]

    if (arrayData.length === 0) {
      throw new Error(`No history data found for ${identifier.symbol} on ${dateStr}`)
    }

    const item = arrayData[0]
    if (!item) {
      throw new Error(`No history data found for ${identifier.symbol} on ${dateStr}`)
    }

    return mapEodhdToSecurityHistory(item, identifier.symbol)

  } catch (error) {
    console.error(`Error fetching EODHD history for ${identifier.symbol}:`, error)
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
    const apiKey = validateApiKeyOptional('EODHD_API_KEY', 'EODHD')
    if (!apiKey) {
      return []
    }

    const dateStr = validateAndExtractDateString(date)
    
    // Convert date to Unix timestamps for the start and end of the day
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    const fromTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const toTimestamp = Math.floor(endOfDay.getTime() / 1000)
    
    // Build the intraday URL with specified interval (default to 15m if not specified)
    const interval = options?.interval?.replace('min', 'm') || '15m'
    
    // Use the exchange from the identifier, defaulting to US if not provided
    const exchange = identifier.exchange || 'US'
    const url = `https://eodhd.com/api/intraday/${identifier.symbol}.${exchange}?api_token=${apiKey}&interval=${interval}&from=${fromTimestamp}&to=${toTimestamp}&fmt=json`
    
    const data: EODHDIntradayResponse[] = await makeApiRequest(url, 'EODHD')
    const arrayData = validateArrayResponse(data, 'EODHD Intraday API') as EODHDIntradayResponse[]

    if (arrayData.length === 0) {
      return []
    }

    // Map the intraday data to SecurityHistory format
    return arrayData.map((item): SecurityHistory => mapEodhdIntradayToSecurityHistory(item, identifier.symbol))
  }, `Error getting intraday history for ${identifier.symbol} on ${date instanceof Date && !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : 'invalid-date'}`, [])
}

/**
 * Maps EODHD intraday response to SecurityHistory type
 * @param item The EODHD intraday response item
 * @param symbol The security symbol
 * @returns SecurityHistory object
 */
export const mapEodhdIntradayToSecurityHistory = (item: EODHDIntradayResponse, symbol: string): SecurityHistory => ({
  symbol,
  date: new Date(item.datetime), // EODHD provides datetime in UTC
  open: item.open,
  high: item.high,
  low: item.low,
  close: item.close,
})