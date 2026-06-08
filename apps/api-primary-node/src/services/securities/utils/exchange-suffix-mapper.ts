/**
 * Alpha Vantage Exchange Suffix Mapping Utility
 * 
 * This utility handles the extraction and mapping of exchange information
 * from Alpha Vantage symbol suffixes.
 * 
 * Based on our "APPL" search test, we discovered that Alpha Vantage embeds
 * exchange information in symbol suffixes (e.g., "AAPL34.SAO", "APC.DEX").
 */

export interface ExchangeSuffixMapping {
  suffix: string;
  exchange: string;
  market: string;
  currency: string;
  description: string;
}

/**
 * Mapping of Alpha Vantage exchange suffixes to our internal exchange codes
 * Based on our comprehensive symbol search tests
 */
export const ALPHA_VANTAGE_EXCHANGE_SUFFIXES: ExchangeSuffixMapping[] = [
  {
    suffix: '', // No suffix for US primary market
    exchange: 'US',
    market: 'United States',
    currency: 'USD',
    description: 'US Primary Market (NASDAQ, NYSE)'
  },
  // London Stock Exchange
  {
    suffix: 'LON',
    exchange: 'LSE',
    market: 'London',
    currency: 'GBP',
    description: 'London Stock Exchange'
  },
  // Amsterdam Stock Exchange
  {
    suffix: 'AMS',
    exchange: 'AMS',
    market: 'Amsterdam',
    currency: 'EUR',
    description: 'Euronext Amsterdam'
  },
  // Paris Stock Exchange
  {
    suffix: 'PAR',
    exchange: 'PAR',
    market: 'Paris',
    currency: 'EUR',
    description: 'Euronext Paris'
  },
  // Shenzhen Stock Exchange
  {
    suffix: 'SHZ',
    exchange: 'SHZ',
    market: 'Shenzhen',
    currency: 'CNY',
    description: 'Shenzhen Stock Exchange'
  },
  // Alpha Vantage International Exchanges
  {
    suffix: 'SAO',
    exchange: 'SAO',
    market: 'Brazil/Sao Paolo',
    currency: 'BRL',
    description: 'Brazilian Stock Exchange'
  },
  {
    suffix: 'DEX',
    exchange: 'DEX',
    market: 'XETRA',
    currency: 'EUR',
    description: 'Deutsche Börse XETRA'
  },
  {
    suffix: 'TRT',
    exchange: 'TRT',
    market: 'Toronto',
    currency: 'CAD',
    description: 'Toronto Stock Exchange'
  },
  {
    suffix: 'BSE',
    exchange: 'BSE',
    market: 'India/Bombay',
    currency: 'INR',
    description: 'Bombay Stock Exchange'
  },
  {
    suffix: 'FRK',
    exchange: 'FRK',
    market: 'Frankfurt',
    currency: 'EUR',
    description: 'Frankfurt Stock Exchange'
  },
  {
    suffix: 'SHH',
    exchange: 'SHH',
    market: 'Shanghai',
    currency: 'CNY',
    description: 'Shanghai Stock Exchange'
  }
];

/**
 * Extracts exchange information from an Alpha Vantage symbol
 * 
 * @param symbol - The Alpha Vantage symbol (e.g., "AAPL", "AAPL34.SAO", "APC.DEX")
 * @returns Object containing the base symbol and exchange information
 */
export function extractExchangeFromAlphaVantageSymbol(symbol: string): {
  baseSymbol: string;
  exchange?: string;
  currency?: string;
} {
  // Note: Alpha Vantage search API doesn't include US class shares (BRK.A, BAC.PR, etc.)
  // So we don't need special handling for them in this context

  // Split by the last dot to handle cases like "AAPL34.SAO"
  const parts = symbol.split('.');
  
  if (parts.length === 1) {
    // No dot in symbol - we can assume this is US market
    return {
      baseSymbol: symbol,
      exchange: 'US',
      currency: 'USD'
    };
  }

  const suffix = parts[parts.length - 1];
  const baseSymbol = parts.slice(0, -1).join('.');
  
  // Find the exchange mapping
  const mapping = ALPHA_VANTAGE_EXCHANGE_SUFFIXES.find(m => m.suffix === suffix);
  
  if (mapping) {
    return {
      baseSymbol,
      exchange: mapping.exchange,
      currency: mapping.currency
    };
  }

  // Unknown suffix - return undefined exchange to indicate we don't know
  return {
    baseSymbol: symbol,
    exchange: undefined,
    currency: undefined
  };
}

/**
 * Gets exchange information for a given Alpha Vantage symbol
 * 
 * @param symbol - The Alpha Vantage symbol
 * @returns Exchange information or undefined if not found
 */
export function getExchangeInfoForAlphaVantageSymbol(symbol: string): ExchangeSuffixMapping | undefined {
  const { exchange } = extractExchangeFromAlphaVantageSymbol(symbol);
  return ALPHA_VANTAGE_EXCHANGE_SUFFIXES.find(m => m.exchange === exchange);
}

/**
 * Normalizes an Alpha Vantage symbol for intraday API calls
 * 
 * @param symbol - The Alpha Vantage symbol
 * @returns The normalized symbol for API calls
 */
export function normalizeAlphaVantageSymbolForIntraday(symbol: string): string {
  // For Alpha Vantage intraday calls, we use the full symbol as-is
  // The API expects the complete symbol including any exchange suffixes
  return symbol;
} 