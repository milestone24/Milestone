import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findSecurities } from './search'

// Mock fetch globally
global.fetch = vi.fn()

describe('EODHD findSecurities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variable
    delete process.env.EODHD_API_KEY
  })

  it('should return empty array when API key is not provided', async () => {
    const result = await findSecurities(['AAPL'])
    expect(result).toEqual([])
  })

  it('should return empty array when no security identifiers provided', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'
    const result = await findSecurities([])
    expect(result).toEqual([])
  })

  it('should search for securities when API key is provided', async () => {
    // Mock API key
    process.env.EODHD_API_KEY = 'test-api-key'

    // Mock successful API response
    const mockResponse = [
      {
        Code: "AAPL",
        Country: "US",
        Currency: "USD",
        Exchange: "NASDAQ",
        ISIN: "US0378331005",
        Name: "Apple Inc",
        Type: "Common Stock",
        previousClose: 150.25,
        previousCloseDate: "2024-01-15"
      }
    ]

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL'])

    expect(fetch).toHaveBeenCalledWith(
      'https://eodhd.com/api/search/AAPL?api_token=test-api-key',
      {
        headers: {
          "Accept": "application/json",
        },
      }
    )

    expect(result).toEqual(mockResponse)
  })

  it('should handle multiple security identifiers', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    const mockResponse = [
      {
        Code: "AAPL",
        Country: "US",
        Currency: "USD",
        Exchange: "NASDAQ",
        ISIN: "US0378331005",
        Name: "Apple Inc",
        Type: "Common Stock",
        previousClose: 150.25,
        previousCloseDate: "2024-01-15"
      },
      {
        Code: "GOOGL",
        Country: "US",
        Currency: "USD",
        Exchange: "NASDAQ",
        ISIN: "US02079K3059",
        Name: "Alphabet Inc",
        Type: "Common Stock",
        previousClose: 2800.50,
        previousCloseDate: "2024-01-15"
      }
    ]

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL', 'GOOGL'])

    expect(fetch).toHaveBeenCalledWith(
      'https://eodhd.com/api/search/AAPL,GOOGL?api_token=test-api-key',
      {
        headers: {
          "Accept": "application/json",
        },
      }
    )

    expect(result).toEqual(mockResponse)
  })

  it('should handle API error responses', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    const mockResponse = {
      error: "Invalid API token",
      message: "Authentication failed",
      status: "error"
    }

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should handle HTTP errors gracefully', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    })

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should handle network errors gracefully', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should handle unexpected data format', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    const mockResponse = "unexpected string response"

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL'])

    expect(result).toEqual([])
  })

  it('should filter out invalid securities from response', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    const mockResponse = [
      {
        Code: "AAPL",
        Country: "US",
        Currency: "USD",
        Exchange: "NASDAQ",
        ISIN: "US0378331005",
        Name: "Apple Inc",
        Type: "Common Stock",
        previousClose: 150.25,
        previousCloseDate: "2024-01-15"
      },
      {
        // Invalid security missing required fields
        Country: "US",
        Currency: "USD"
      },
      null,
      undefined
    ]

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['AAPL'])

    expect(result).toHaveLength(1)
    expect(result[0].Code).toBe('AAPL')
  })

  it('should handle empty array response', async () => {
    process.env.EODHD_API_KEY = 'test-api-key'

    const mockResponse: any[] = []

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await findSecurities(['INVALID'])

    expect(result).toEqual([])
  })
}) 