import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSecurityHistoryForDateRange, getSecurityHistoryForDate, getIntradaySecurityHistoryForDate } from './history'
import { SecurityIdentifier } from '../types'

// Mock fetch globally
global.fetch = vi.fn()

describe('Alpha Vantage History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variable
    delete process.env.ALPHA_VANTAGE_API_KEY
  })

  describe('getSecurityHistoryForDateRange', () => {
    it('should return empty array when API key is not provided', async () => {
      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))
      expect(result).toEqual([])
    })

    it('should fetch history for date range when API key is provided', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Meta Data": {
          "1. Information": "Daily Prices (open, high, low, close) and Volumes",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-01-16",
          "4. Output Size": "Full size",
          "5. Time Zone": "US/Eastern"
        },
        "Time Series (Daily)": {
          "2024-01-15": {
            "1. open": "150.25",
            "2. high": "152.50",
            "3. low": "149.75",
            "4. close": "151.00",
            "5. volume": "1000000"
          },
          "2024-01-16": {
            "1. open": "151.00",
            "2. high": "153.25",
            "3. low": "150.50",
            "4. close": "152.75",
            "5. volume": "1100000"
          }
        }
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-15'), new Date('2024-01-16'))

      expect(fetch).toHaveBeenCalledWith(
        'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&outputsize=full&apikey=test-api-key',
        {
          headers: {
            "Accept": "application/json",
          },
        }
      )

      expect(result).toEqual([
        {
          symbol: 'AAPL',
          date: new Date('2024-01-15'),
          open: 150.25,
          high: 152.50,
          low: 149.75,
          close: 151.00,
        },
        {
          symbol: 'AAPL',
          date: new Date('2024-01-16'),
          open: 151.00,
          high: 153.25,
          low: 150.50,
          close: 152.75,
        }
      ])
    })

    it('should handle API errors gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Error Message": "Invalid API call"
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDateRange('INVALID', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })

    it('should handle rate limiting gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Note": "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day."
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })

    it('should handle HTTP errors gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      })

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })

    it('should handle invalid dates gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      // Create invalid dates that would result in undefined dateStr
      const invalidStartDate = new Date('invalid-start-date')
      const invalidEndDate = new Date('invalid-end-date')

      // Mock a successful response so we can test the date validation
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "Meta Data": {
            "1. Information": "Daily Prices (open, high, low, close) and Volumes",
            "2. Symbol": "AAPL",
            "3. Last Refreshed": "2024-01-15",
            "4. Output Size": "Full size",
            "5. Time Zone": "US/Eastern"
          },
          "Time Series (Daily)": {}
        })
      })

      const result = await getSecurityHistoryForDateRange('AAPL', invalidStartDate, invalidEndDate)

      expect(result).toEqual([])
    })
  })

  describe('getSecurityHistoryForDate', () => {
    it('should throw error when API key is not provided', async () => {
      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('Alpha Vantage API key not configured')
    })

    it('should fetch history for specific date when API key is provided', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Meta Data": {
          "1. Information": "Daily Prices (open, high, low, close) and Volumes",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-01-15",
          "4. Output Size": "Compact",
          "5. Time Zone": "US/Eastern"
        },
        "Time Series (Daily)": {
          "2024-01-15": {
            "1. open": "150.25",
            "2. high": "152.50",
            "3. low": "149.75",
            "4. close": "151.00",
            "5. volume": "1000000"
          }
        }
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))

      expect(fetch).toHaveBeenCalledWith(
        'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&outputsize=compact&apikey=test-api-key',
        {
          headers: {
            "Accept": "application/json",
          },
        }
      )

      expect(result).toEqual({
        symbol: 'AAPL',
        date: new Date('2024-01-15'),
        open: 150.25,
        high: 152.50,
        low: 149.75,
        close: 151.00,
      })
    })

    it('should throw error when API error occurs', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Error Message": "Invalid API call"
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await expect(getSecurityHistoryForDate('INVALID', new Date('2024-01-15'))).rejects.toThrow('Alpha Vantage API error: Invalid API call')
    })

    it('should throw error when rate limited', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Note": "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day."
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('Alpha Vantage API rate limit: Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.')
    })

    it('should throw error when HTTP error occurs', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('Alpha Vantage API error: 401 Unauthorized')
    })

    it('should throw error when no data found for date', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Meta Data": {
          "1. Information": "Daily Prices (open, high, low, close) and Volumes",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-01-15",
          "4. Output Size": "Compact",
          "5. Time Zone": "US/Eastern"
        },
        "Time Series (Daily)": {}
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('No history data found for AAPL on 2024-01-15')
    })

    it('should throw error when network error occurs', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('Network error')
    })

    it('should throw error when date string is invalid', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      // Create an invalid date that would result in undefined dateStr
      const invalidDate = new Date('invalid-date')

      // Mock a successful response so we can test the date validation
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "Meta Data": {
            "1. Information": "Daily Prices (open, high, low, close) and Volumes",
            "2. Symbol": "AAPL",
            "3. Last Refreshed": "2024-01-15",
            "4. Output Size": "Compact",
            "5. Time Zone": "US/Eastern"
          },
          "Time Series (Daily)": {}
        })
      })

      await expect(getSecurityHistoryForDate('AAPL', invalidDate)).rejects.toThrow('Invalid date format - could not extract date string')
    })
  })

  describe('getIntradaySecurityHistoryForDate', () => {
    it('should return empty array when API key is not provided', async () => {
      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))
      expect(result).toEqual([])
    })

    it('should fetch intraday data when API key is provided', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Meta Data": {
          "1. Information": "Intraday (15min) open, high, low, close prices and volume",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-01-15 16:00:00",
          "4. Output Size": "Compact size",
          "5. Time Zone": "US/Eastern"
        },
        "Time Series (15min)": {
          "2024-01-15 09:30:00": {
            "1. open": "150.00",
            "2. high": "151.50",
            "3. low": "149.80",
            "4. close": "151.20",
            "5. volume": "1000000"
          },
          "2024-01-15 09:31:00": {
            "1. open": "151.20",
            "2. high": "152.00",
            "3. low": "151.00",
            "4. close": "151.80",
            "5. volume": "800000"
          }
        }
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(fetch).toHaveBeenCalledWith(
        'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=AAPL&interval=15min&apikey=test-api-key&outputsize=compact',
        {
          headers: {
            "Accept": "application/json",
          },
        }
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        symbol: 'AAPL',
        date: new Date('2024-01-15T14:30:00.000Z'), // 09:30 US/Eastern = 14:30 UTC
        open: 150.00,
        high: 151.50,
        low: 149.80,
        close: 151.20
      })
      expect(result[1]).toEqual({
        symbol: 'AAPL',
        date: new Date('2024-01-15T14:31:00.000Z'), // 09:31 US/Eastern = 14:31 UTC
        open: 151.20,
        high: 152.00,
        low: 151.00,
        close: 151.80
      })
    })

    it('should filter data for specific date only', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const mockResponse = {
        "Meta Data": {
          "1. Information": "Intraday (15min) open, high, low, close prices and volume",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-01-16 16:00:00",
          "4. Output Size": "Compact size",
          "5. Time Zone": "US/Eastern"
        },
        "Time Series (15min)": {
          "2024-01-15 09:30:00": {
            "1. open": "150.00",
            "2. high": "151.50",
            "3. low": "149.80",
            "4. close": "151.20",
            "5. volume": "1000000"
          },
          "2024-01-16 09:30:00": {
            "1. open": "152.00",
            "2. high": "153.50",
            "3. low": "151.80",
            "4. close": "153.20",
            "5. volume": "1200000"
          }
        }
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(result).toHaveLength(1)
      expect(result[0]?.date).toEqual(new Date('2024-01-15T14:30:00.000Z')) // 09:30 US/Eastern = 14:30 UTC
    })

    it('should handle API errors gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(result).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(result).toEqual([])
    })

    it('should handle invalid date gracefully', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('invalid-date'))

      expect(result).toEqual([])
    })

    it('should use specified interval when provided', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'
      
      const mockResponse = {
        "Meta Data": {
          "1. Information": "Intraday (5min) open, high, low, close prices and volume",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-01-15 16:00:00",
          "4. Output Size": "Full size",
          "5. Time Zone": "US/Eastern"
        },
        "Time Series (15min)": {
          "2024-01-15 09:30:00": {
            "1. open": "150.00",
            "2. high": "151.50",
            "3. low": "149.80",
            "4. close": "151.20",
            "5. volume": "1000"
          }
        }
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'), { interval: '15min' })

      expect(fetch).toHaveBeenCalledWith(
        'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=AAPL&interval=15min&apikey=test-api-key&outputsize=compact',
        {
          headers: {
            "Accept": "application/json",
          },
        }
      )
      expect(result).toHaveLength(1)
    })
  })
}) 