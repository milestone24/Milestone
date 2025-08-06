import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findSecurities } from './search'
import { extractExchangeFromAlphaVantageSymbol } from '../utils/exchange-suffix-mapper'

// Mock fetch globally
global.fetch = vi.fn()

describe('Alpha Vantage findSecurities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variable
    delete process.env.ALPHA_VANTAGE_API_KEY
  })

  it('should return empty array when API key is not provided', async () => {
    const result = await findSecurities(['AAPL'])
    expect(result).toEqual([])
  })

  it('should search for securities when API key is provided', async () => {
    // Mock API key
    process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

    // Mock successful API response
    const mockResponse = {
      bestMatches: [
        {
          "1. symbol": "AAPL",
          "2. name": "Apple Inc",
          "3. type": "Equity",
          "4. region": "United States",
          "5. marketOpen": "09:30",
          "6. marketClose": "16:00",
          "7. timezone": "UTC-04",
          "8. currency": "USD",
          "9. matchScore": "1.0000"
        }
      ]
    }

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL'])

    expect(fetch).toHaveBeenCalledWith(
      'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=AAPL&apikey=test-api-key',
      {
        headers: {
          "Accept": "application/json",
        },
      }
    )

            expect(result).toEqual([
          {
            symbol: "AAPL",
            name: "Apple Inc",
            type: "Equity",
            country: "United States",
            currency: "USD",
            exchange: "US",
            isin: undefined,
            cusip: undefined,
            figi: undefined,
            fromCache: false,
            sourceIdentifier: "alpha-vantage",
          }
        ])
  })

  it('should handle API errors gracefully', async () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

    const mockResponse = {
      Error: "Invalid API call"
    }

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['INVALID'])

    expect(result).toEqual([])
  })

  it('should handle rate limiting gracefully', async () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

    const mockResponse = {
      Note: "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day."
    }

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should handle network errors gracefully', async () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

    ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should handle HTTP errors gracefully', async () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    })

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should search multiple identifiers', async () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-api-key'

    const mockResponse1 = {
      bestMatches: [
        {
          "1. symbol": "AAPL",
          "2. name": "Apple Inc",
          "3. type": "Equity",
          "4. region": "United States",
          "5. marketOpen": "09:30",
          "6. marketClose": "16:00",
          "7. timezone": "UTC-04",
          "8. currency": "USD",
          "9. matchScore": "1.0000"
        }
      ]
    }

    const mockResponse2 = {
      bestMatches: [
        {
          "1. symbol": "GOOGL",
          "2. name": "Alphabet Inc",
          "3. type": "Equity",
          "4. region": "United States",
          "5. marketOpen": "09:30",
          "6. marketClose": "16:00",
          "7. timezone": "UTC-04",
          "8. currency": "USD",
          "9. matchScore": "1.0000"
        }
      ]
    }

    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse1
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse2
      })

    const result = await findSecurities(['AAPL', 'GOOGL'])

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)
    expect(result[0].symbol).toBe('AAPL')
    expect(result[1].symbol).toBe('GOOGL')
  })
})

describe('Exchange Suffix Logic', () => {
  it('should correctly identify US symbols without dots', () => {
    expect(extractExchangeFromAlphaVantageSymbol('AAPL').exchange).toBe('US')
    expect(extractExchangeFromAlphaVantageSymbol('MSFT').exchange).toBe('US')
    expect(extractExchangeFromAlphaVantageSymbol('GOOGL').exchange).toBe('US')
  })

  it('should correctly identify London Stock Exchange symbols', () => {
    expect(extractExchangeFromAlphaVantageSymbol('VWRL.LON').exchange).toBe('LSE')
    expect(extractExchangeFromAlphaVantageSymbol('AAPL.LON').exchange).toBe('LSE')
  })

  it('should correctly identify Amsterdam Stock Exchange symbols', () => {
    expect(extractExchangeFromAlphaVantageSymbol('VWRL.AMS').exchange).toBe('AMS')
  })

  it('should correctly identify Alpha Vantage international exchanges', () => {
    expect(extractExchangeFromAlphaVantageSymbol('AAPL34.SAO').exchange).toBe('SAO')
    expect(extractExchangeFromAlphaVantageSymbol('APC.DEX').exchange).toBe('DEX')
    expect(extractExchangeFromAlphaVantageSymbol('AAPL.TRT').exchange).toBe('TRT')
    expect(extractExchangeFromAlphaVantageSymbol('500014.BSE').exchange).toBe('BSE')
    expect(extractExchangeFromAlphaVantageSymbol('48T.FRK').exchange).toBe('FRK')
    expect(extractExchangeFromAlphaVantageSymbol('603020.SHH').exchange).toBe('SHH')
    expect(extractExchangeFromAlphaVantageSymbol('ABCA.PAR').exchange).toBe('PAR')
    expect(extractExchangeFromAlphaVantageSymbol('301510.SHZ').exchange).toBe('SHZ')
  })

  it('should return undefined for unknown exchange suffixes', () => {
    expect(extractExchangeFromAlphaVantageSymbol('STOCK.XYZ').exchange).toBeUndefined()
    expect(extractExchangeFromAlphaVantageSymbol('UNKNOWN.ABC').exchange).toBeUndefined()
  })
}) 