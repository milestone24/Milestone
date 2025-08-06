/**
 * EODHD Search API Module
 * 
 * This module implements the EODHD Search API for finding stocks, ETFs, mutual funds, and indices.
 * 
 * API Documentation: https://eodhd.com/financial-apis/search-api-for-stocks-etfs-mutual-funds
 * 
 * Key Features:
 * - Search by ticker code, company name, or ISIN
 * - Automatic prioritization based on search query type
 * - Result ordering by market capitalization and trading volume
 * - Support for multiple asset types (stocks, ETFs, funds, bonds, indices, crypto)
 * - Exchange filtering capabilities
 * 
 * API Endpoint: https://eodhd.com/api/search/{query_string}?api_token={YOUR_API_TOKEN}&fmt=json
 * 
 * Parameters:
 * - query_string: Required. Can be ticker code, company name, or ISIN
 * - limit: Optional. Number of results (default: 15, max: 500)
 * - bonds_only: Optional. Include bonds in results (0=no, 1=yes)
 * - exchange: Optional. Filter by exchange code (US, PA, CC, FOREX, etc.)
 * - type: Optional. Asset type filter (all, stock, etf, fund, bond, index, crypto)
 */

import { EODHDSecurity } from "."
import { validateApiKeyOptional } from "../../../utils/api-key-validation"
import { makeApiRequest } from "../../../utils/http-client"
import { withErrorHandling } from "../../../utils/error-handling"
import { validateArrayResponse } from "../../../utils/response-validation"
import { buildEodhdSearchUrl } from "../utils/provider-url-builders"
import { validateEodhdResponse } from "../utils/provider-response-validation"

export type EODHDSearchResponse = EODHDSecurity[] | {
  error?: string;
  message?: string;
  status?: string;
}

export async function findSecurities(securityIdentifiers: string[]): Promise<EODHDSecurity[]> {
  const apiKey = validateApiKeyOptional("EODHD_API_KEY", "EODHD")
  if (!apiKey) {
    return []
  }

  if (securityIdentifiers.length === 0) {
    return []
  }

  return withErrorHandling(
    async () => {
      const queryParams = securityIdentifiers.join(",")
      const url = buildEodhdSearchUrl(queryParams, apiKey)
      
      const data: EODHDSearchResponse = await makeApiRequest(url, "EODHD")
      validateEodhdResponse(data)

      const arrayData = validateArrayResponse(data, "EODHD API") as EODHDSecurity[]

      // Filter out any invalid entries
      const validSecurities = arrayData.filter((security): security is EODHDSecurity => {
        return security && 
               typeof security === 'object' && 
               typeof (security as any).Code === 'string' && 
               typeof (security as any).Name === 'string'
      })

      return validSecurities
    },
    "searching EODHD",
    []
  )
}
