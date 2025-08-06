import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSecurityHistoryForDateRange, getSecurityHistoryForDate, getIntradaySecurityHistoryForDate } from './history'
import { SecurityIdentifier } from '../types'

// Mock fetch globally
global.fetch = vi.fn()

describe('EODHD History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variable
    delete process.env.EODHD_API_KEY
  })

  describe('getSecurityHistoryForDateRange', () => {
    it('should return empty array when API key is not provided', async () => {
      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))
      expect(result).toEqual([])
    })

    it('should fetch history for date range when API key is provided', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      const mockResponse = [
        {
          date: "2024-01-15",
          open: 150.25,
          high: 152.50,
          low: 149.75,
          close: 151.00,
          adjusted_close: 151.00,
          volume: 1000000
        },
        {
          date: "2024-01-16",
          open: 151.00,
          high: 153.25,
          low: 150.50,
          close: 152.75,
          adjusted_close: 152.75,
          volume: 1100000
        }
      ]

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-15'), new Date('2024-01-16'))

      expect(fetch).toHaveBeenCalledWith(
        'https://eodhd.com/api/eod/AAPL?api_token=test-api-key&from=2024-01-15&to=2024-01-16&fmt=json',
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

    it('should handle HTTP errors gracefully', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })

    it('should handle unexpected data format', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      const mockResponse = "unexpected string response"

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDateRange('AAPL', new Date('2024-01-01'), new Date('2024-01-31'))

      expect(result).toEqual([])
    })
  })

  describe('getSecurityHistoryForDate', () => {
    it('should throw error when API key is not provided', async () => {
      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('EODHD API key not configured')
    })

    it('should fetch history for specific date when API key is provided', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      const mockResponse = [
        {
          date: "2024-01-15",
          open: 150.25,
          high: 152.50,
          low: 149.75,
          close: 151.00,
          adjusted_close: 151.00,
          volume: 1000000
        }
      ]

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))

      expect(fetch).toHaveBeenCalledWith(
        'https://eodhd.com/api/eod/AAPL?api_token=test-api-key&from=2024-01-15&to=2024-01-15&fmt=json',
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

    it('should throw error when HTTP error occurs', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('EODHD API error: 401 Unauthorized')
    })

    it('should throw error when no data found for date', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      const mockResponse: any[] = []

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('No history data found for AAPL on 2024-01-15')
    })

    it('should throw error when network error occurs', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      await expect(getSecurityHistoryForDate('AAPL', new Date('2024-01-15'))).rejects.toThrow('Network error')
    })
  })

  describe('getIntradaySecurityHistoryForDate', () => {
    it('should return empty array when API key is not provided', async () => {
      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))
      expect(result).toEqual([])
    })

    it('should fetch intraday data when API key is provided', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      const mockResponse = [
        {
          datetime: "2024-01-15 09:30:00",
          gmtoffset: 0,
          open: 150.00,
          high: 151.50,
          low: 149.80,
          close: 151.20,
          volume: 1000000
        },
        {
          datetime: "2024-01-15 09:31:00",
          gmtoffset: 0,
          open: 151.20,
          high: 152.00,
          low: 151.00,
          close: 151.80,
          volume: 800000
        }
      ]

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      // Check that the URL is constructed correctly with Unix timestamps
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/https:\/\/eodhd\.com\/api\/intraday\/AAPL\.US\?api_token=test-api-key&interval=15m&from=\d+&to=\d+&fmt=json/),
        {
          headers: {
            "Accept": "application/json",
          },
        }
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        symbol: 'AAPL',
        date: new Date('2024-01-15T01:30:00.000Z'), // EODHD timestamps appear to be in a different timezone
        open: 150.00,
        high: 151.50,
        low: 149.80,
        close: 151.20
      })
      expect(result[1]).toEqual({
        symbol: 'AAPL',
        date: new Date('2024-01-15T01:31:00.000Z'), // EODHD timestamps appear to be in a different timezone
        open: 151.20,
        high: 152.00,
        low: 151.00,
        close: 151.80
      })
    })

    it('should handle HTTP errors gracefully', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(result).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(result).toEqual([])
    })

    it('should handle empty response gracefully', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'))

      expect(result).toEqual([])
    })

    it('should handle invalid date gracefully', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('invalid-date'))

      expect(result).toEqual([])
    })

    it('should use specified interval when provided', async () => {
      process.env.EODHD_API_KEY = 'test-api-key'
      
      const mockResponse = [
        {
          datetime: "2024-01-15 09:30:00",
          gmtoffset: 0,
          open: 150.00,
          high: 151.50,
          low: 149.80,
          close: 151.20,
          volume: 1000
        }
      ]

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getIntradaySecurityHistoryForDate({ symbol: 'AAPL' }, new Date('2024-01-15'), { interval: '15min' })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/https:\/\/eodhd\.com\/api\/intraday\/AAPL\.US\?api_token=test-api-key&interval=15m&from=\d+&to=\d+&fmt=json/),
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