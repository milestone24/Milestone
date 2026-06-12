import { SecurityIdentifier } from "../types"

/**
 * Builds an EODHD EOD URL with symbol in the path
 * @param symbol The security symbol
 * @param apiToken The API token
 * @param fromDate The start date
 * @param toDate The end date
 * @returns The complete EODHD EOD URL
 */
export const buildEodhdEodUrl = (identifier: SecurityIdentifier, apiToken: string, fromDate: string, toDate: string): string => {
  return `https://eodhd.com/api/eod/${identifier.symbol}.${identifier.exchange}?api_token=${apiToken}&from=${fromDate}&to=${toDate}&fmt=json`
}

/**
 * Builds an EODHD search URL with symbols in the path
 * @param symbols The symbols to search for (comma-separated)
 * @param apiToken The API token
 * @returns The complete EODHD search URL
 */
export const buildEodhdSearchUrl = (symbols: string, apiToken: string): string => {
  return `https://eodhd.com/api/search/${symbols}?api_token=${apiToken}`
}

/**
 * Builds an Alpha Vantage API URL with query parameters
 * @param params Query parameters as key-value pairs
 * @returns The complete Alpha Vantage API URL
 */
export const buildAlphaVantageUrl = (params: Record<string, string>): string => {
  const url = new URL("https://www.alphavantage.co/query")
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return url.toString()
} 