/**
 * Validates Alpha Vantage API response for common error conditions
 * @param data The Alpha Vantage API response
 * @throws Error if the response contains an error message or rate limit note
 */
export const validateAlphaVantageResponse = (data: any): void => {
  if (data["Error Message"]) {
    throw new Error(`Alpha Vantage API error: ${data["Error Message"]}`)
  }
  if (data["Note"]) {
    throw new Error(`Alpha Vantage API rate limit: ${data["Note"]}`)
  }
}

/**
 * Validates EODHD API response for common error conditions
 * @param data The EODHD API response
 * @throws Error if the response contains an error message
 */
export const validateEodhdResponse = (data: any): void => {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    if (data.error || data.message) {
      throw new Error(`EODHD API error: ${data.error || data.message}`)
    }
  }
}

/**
 * Validates that Alpha Vantage time series data exists
 * @param data The Alpha Vantage API response
 * @param context Context for error messages
 * @returns The time series data or throws an error
 * @throws Error if time series data is missing
 */
export const validateAlphaVantageTimeSeries = (data: any, context: string): any => {
  // First check for the specific time series key if provided
  if (context.startsWith("Time Series (")) {
    const timeSeries = data[context]
    if (timeSeries) {
      return timeSeries
    }
  }
  
  // Check for daily time series first (most common)
  let timeSeries = data["Time Series (Daily)"]
  
  // If not found, check for intraday time series (15min and higher)
  if (!timeSeries) {
    timeSeries = data["Time Series (15min)"]
  }
  if (!timeSeries) {
    timeSeries = data["Time Series (30min)"]
  }
  if (!timeSeries) {
    timeSeries = data["Time Series (60min)"]
  }
  
  if (!timeSeries) {
    throw new Error(`${context} returned unexpected data format for history`)
  }
  return timeSeries
} 