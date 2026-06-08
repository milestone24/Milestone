import { SecuritySearchResult } from "@shared/schema"
import { validateApiKeyOptional } from "../../../utils/api-key-validation"
import { makeApiRequest } from "../../../utils/http-client"
import { withErrorHandling } from "../../../utils/error-handling"
import { buildAlphaVantageUrl } from "../utils/provider-url-builders"
import { validateAlphaVantageResponse } from "../utils/provider-response-validation"
import { extractExchangeFromAlphaVantageSymbol } from "../utils/exchange-suffix-mapper"

export type AlphaVantageSearchResult = {
  "1. symbol": string;
  "2. name": string;
  "3. type": string;
  "4. region": string;
  "5. marketOpen": string;
  "6. marketClose": string;
  "7. timezone": string;
  "8. currency": string;
  "9. matchScore": string;
}

export type AlphaVantageSearchResponse = {
  bestMatches?: AlphaVantageSearchResult[];
  Note?: string;
  Error?: string;
}

export const findSecurities = async (securityIdentifiers: string[]): Promise<SecuritySearchResult[]> => {
  const apiKey = validateApiKeyOptional("ALPHA_VANTAGE_API_KEY", "Alpha Vantage")
  if (!apiKey) {
    return []
  }

  const results: SecuritySearchResult[] = []

  for (const identifier of securityIdentifiers) {
    const searchResult = await withErrorHandling(
      async () => {
        const url = buildAlphaVantageUrl({
          function: "SYMBOL_SEARCH",
          keywords: identifier,
          apikey: apiKey,
        })

        const data: AlphaVantageSearchResponse = await makeApiRequest(url, "Alpha Vantage")
        validateAlphaVantageResponse(data)

        // Process search results
        if (data.bestMatches && Array.isArray(data.bestMatches)) {
          return data.bestMatches.map((match): SecuritySearchResult => {
            const symbol = match["1. symbol"];
            const exchangeInfo = extractExchangeFromAlphaVantageSymbol(symbol);
            
            return {
              symbol: symbol,
              name: match["2. name"],
              type: match["3. type"],
              country: match["4. region"],
              currency: match["8. currency"],
              exchange: exchangeInfo.exchange, // Extract exchange from symbol suffix
              isin: undefined,
              cusip: undefined,
              figi: undefined,
              fromCache: false,
              sourceIdentifier: "alpha-vantage",
            };
          });
        }
        return []
      },
      `searching Alpha Vantage for ${identifier}`,
      []
    )

    results.push(...searchResult)
  }

  return results
}