import { factory as eodhdFactory } from "./eodhd"
import { factory as alphaVantageFactory } from "./alpha-vantage"
import { SecuritySearchResult } from "@shared/schema"
import { combineSecurityResults } from "@server/utils/securities"
import { searchCachedSecurities, getCachedSecurities, createOrFindCachedSecurity, updateCachedSecurity, deleteCachedSecurity, getCachedSecurity } from "./cache"
import { Database } from "@server/db"
import { SecurityHistory, IntradayOptions, SecurityIdentifier } from "./types"

const eodhd = eodhdFactory()
const alphaVantage = alphaVantageFactory()

const securityServices = [
  eodhd,
  alphaVantage
] as const

const servicesWithSearch = securityServices.filter(service => service.canFindSecurities)

const servicesWithHistory = securityServices.filter(service => service.canGetSecurityHistoryForDateRange && service.canGetSecurityHistoryForDate)

const servicesWithIntraday = securityServices.filter(service => service.canGetIntradaySecurityHistoryForDate)

// Configuration for search limiting per provider
const SEARCH_LIMIT_CONFIG = {
  eodhd: {
    maxSearches: parseInt(process.env.EODHD_MAX_SEARCHES || '5'),
    expirationHours: parseInt(process.env.EODHD_SEARCH_EXPIRATION_HOURS || '24'),
    enableExpiration: process.env.EODHD_ENABLE_SEARCH_EXPIRATION === 'true'
  },
  alphaVantage: {
    maxSearches: parseInt(process.env.ALPHA_VANTAGE_MAX_SEARCHES || '5'),
    expirationHours: parseInt(process.env.ALPHA_VANTAGE_SEARCH_EXPIRATION_HOURS || '24'),
    enableExpiration: process.env.ALPHA_VANTAGE_ENABLE_SEARCH_EXPIRATION === 'true'
  }
}

interface SearchRecord {
  count: number;
  lastSearch: Date;
}

// Track search history per provider
const externalSecuritySearchHistory = new Map<string, {
  eodhd: SearchRecord;
  alphaVantage: SearchRecord;
}>()

/**
 * Clear the search history for all identifiers or a specific identifier
 * @param identifier - Optional specific identifier to clear. If not provided, clears all history
 */
export const clearSearchHistory = (identifier?: string): void => {
  if (identifier) {
    externalSecuritySearchHistory.delete(identifier.toUpperCase())
    console.log(`Search history cleared for identifier: ${identifier.toUpperCase()}`)
  } else {
    externalSecuritySearchHistory.clear()
    console.log('All search history cleared')
  }
}

/**
 * Get current search statistics for monitoring
 * @returns Object containing total tracked identifiers and their search counts per provider
 */
export const getSearchStatistics = (): { 
  totalIdentifiers: number; 
  identifiers: Record<string, { eodhd: SearchRecord; alphaVantage: SearchRecord }> 
} => {
  const identifiers: Record<string, { eodhd: SearchRecord; alphaVantage: SearchRecord }> = {}
  externalSecuritySearchHistory.forEach((record, identifier) => {
    identifiers[identifier] = { ...record }
  })
  
  return {
    totalIdentifiers: externalSecuritySearchHistory.size,
    identifiers
  }
}

/**
 * Check if a search record has expired based on provider configuration
 * @param record - The search record to check
 * @param provider - The provider name ('eodhd' or 'alphaVantage')
 * @returns True if the record has expired and should be reset
 */
const isSearchRecordExpired = (record: SearchRecord, provider: 'eodhd' | 'alphaVantage'): boolean => {
  const config = SEARCH_LIMIT_CONFIG[provider]
  if (!config.enableExpiration) {
    return false
  }
  
  const expirationTime = new Date(record.lastSearch.getTime() + (config.expirationHours * 60 * 60 * 1000))
  return new Date() > expirationTime
}

/**
 * Update search count for an identifier and provider
 * @param identifier - The identifier to update
 * @param provider - The provider name ('eodhd' or 'alphaVantage')
 */
const updateSearchCount = (identifier: string, provider: 'eodhd' | 'alphaVantage'): void => {
  const upperIdentifier = identifier.toUpperCase()
  const existingRecord = externalSecuritySearchHistory.get(upperIdentifier)
  
  if (existingRecord) {
    const providerRecord = existingRecord[provider]
    if (providerRecord && isSearchRecordExpired(providerRecord, provider)) {
      // Reset expired record
      existingRecord[provider] = {
        count: 1,
        lastSearch: new Date()
      }
      console.log(`Search count reset for expired identifier: ${upperIdentifier} on ${provider}`)
    } else if (providerRecord) {
      // Increment existing record
      existingRecord[provider] = {
        count: providerRecord.count + 1,
        lastSearch: new Date()
      }
    } else {
      // Create new record for this provider
      existingRecord[provider] = {
        count: 1,
        lastSearch: new Date()
      }
    }
  } else {
    // Create new record for this identifier
    externalSecuritySearchHistory.set(upperIdentifier, {
      eodhd: { count: 0, lastSearch: new Date() },
      alphaVantage: { count: 0, lastSearch: new Date() },
      [provider]: { count: 1, lastSearch: new Date() }
    })
  }
}

/**
 * Check if an identifier can be searched on a specific provider
 * @param identifier - The identifier to check
 * @param provider - The provider name ('eodhd' or 'alphaVantage')
 * @returns True if the identifier can be searched on this provider
 */
const canSearchIdentifier = (identifier: string, provider: 'eodhd' | 'alphaVantage'): boolean => {
  const upperIdentifier = identifier.toUpperCase()
  const record = externalSecuritySearchHistory.get(upperIdentifier)
  const config = SEARCH_LIMIT_CONFIG[provider]
  
  if (!record) {
    return true // New identifier, allow search
  }
  
  const providerRecord = record[provider]
  if (!providerRecord) {
    return true // No record for this provider, allow search
  }
  
  if (isSearchRecordExpired(providerRecord, provider)) {
    return true // Expired record, allow search
  }
  
  if (providerRecord.count < config.maxSearches) {
    return true // Under limit, allow search
  }
  
  // At limit, skip search
  console.warn(`Search limit reached for identifier: ${upperIdentifier} on ${provider} (${providerRecord.count}/${config.maxSearches})`)
  return false
}

/**
 * Find securities by searching external providers with configurable rate limiting per provider
 * 
 * This function implements a simple in-memory search limiting mechanism to prevent
 * excessive API calls for the same security identifiers. Each identifier is limited
 * per provider with configurable limits and time windows.
 * 
 * TODO: Future scalability improvements:
 * - Persist search history to database/Redis for multi-instance deployments
 * - Add monitoring and alerting for rate limit violations
 * - Consider implementing a circuit breaker pattern for API failures
 * 
 * @param securityIdentifiers - Array of security identifiers to search for
 * @returns Promise resolving to array of found securities
 */
const findProviderSecurities = async (securityIdentifiers: string[]): Promise<SecuritySearchResult[]> => {
  // Filter identifiers for each provider based on their respective limits
  const eodhdIdentifiers = securityIdentifiers.filter(identifier => 
    canSearchIdentifier(identifier, 'eodhd')
  )
  
  const alphaVantageIdentifiers = securityIdentifiers.filter(identifier => 
    canSearchIdentifier(identifier, 'alphaVantage')
  )

  // Search EODHD first
  if (eodhdIdentifiers.length > 0) {
    try {
      const results = await eodhd.findSecurities(eodhdIdentifiers)
      // Increment counts for successful API calls (regardless of results found)
      eodhdIdentifiers.forEach(identifier => updateSearchCount(identifier, 'eodhd'))
      
      if (results.length > 0) {
        return results
      }
    } catch (error) {
      console.error('EODHD search failed:', error)
      // Don't increment counts for failed API calls
    }
  }

  // Search Alpha Vantage if EODHD didn't return results
  if (alphaVantageIdentifiers.length > 0) {
    try {
      const results = await alphaVantage.findSecurities(alphaVantageIdentifiers)
      // Increment counts for successful API calls (regardless of results found)
      alphaVantageIdentifiers.forEach(identifier => updateSearchCount(identifier, 'alphaVantage'))
      
      if (results.length > 0) {
        return results
      }
    } catch (error) {
      console.error('Alpha Vantage search failed:', error)
      // Don't increment counts for failed API calls
    }
  }

  return []
}


const findSecurities = async (securityIdentifiers: string[]): Promise<SecuritySearchResult[]> => {


  try {
    //Step 1: Search local cache first for exact symbol matches and partial name matches
    const cachedSecuritiesPromises = securityIdentifiers.map(identifier => 
      searchCachedSecurities(identifier)
    )
    const cachedSecuritiesArrays = await Promise.all(cachedSecuritiesPromises)
    const cachedSecurities = cachedSecuritiesArrays.flat()
      
    // // Step 2: If we have good cached results and query looks like exact symbol, return cache only
    // const isExactSymbolQuery = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/i.test(query);
    // if (cachedSecurities.length > 0 && isExactSymbolQuery) {
    //   return res.json({
    //     source: 'cache',
    //     securities: cachedSecurities.map(security => ({ ...security, fromCache: true })),
    //     fromExternal: false
    //   });
    // }

    // Step 3: Always search external API for fresh results, but limit frequency
    //TODO: need limiter on how many times this is called
    const externalSecurities = await findProviderSecurities(securityIdentifiers)

    //console.log("externalSecurities", externalSecurities);
    
    // Step 4: Combine and deduplicate results, prioritizing external data
    const combinedResults = combineSecurityResults(cachedSecurities, externalSecurities);
    
    // res.json({
    //   source: 'hybrid',
    //   securities: externalSecurities,
    //   fromExternal: true,
    //   cached: cachedSecurities.length,
    //   external: externalSecurities.length
    // });

    return combinedResults;
  } catch (error) {
    console.error("Error finding securities:", error)
    return []
  }
}

const getSecurityHistoryForDateRange = async (identifier: SecurityIdentifier, startDate: Date, endDate: Date): Promise<SecurityHistory[]> => {

  const service = servicesWithHistory.find(service => service.identifier === "eodhd")
  const history = await service?.getSecurityHistoryForDateRange(identifier, startDate, endDate)
  return history || []

  for await ( const service of servicesWithHistory) {
    const history = await service.getSecurityHistoryForDateRange(identifier, startDate, endDate)
    if (history.length > 0) {
      return history
    }
  }
  return []
}

const getSecurityHistoryLiveForDateRange = async (identifier: SecurityIdentifier, startDate: Date, endDate: Date): Promise<SecurityHistory[]> => {

  const service = servicesWithHistory.find(service => service.identifier === "eodhd")
  const history = await service?.getSecurityHistoryLiveForDateRange(identifier, startDate, endDate)
  return history || []

  for await ( const service of servicesWithHistory) {
    const history = await service.getSecurityHistoryForDateRange(identifier, startDate, endDate)
    if (history.length > 0) {
      return history
    }
  }
  return []
}

const getSecurityHistoryForDate = async (identifier: SecurityIdentifier, date: Date): Promise<SecurityHistory | null> => {

  const service = servicesWithHistory.find(service => service.identifier === "eodhd")
  const history = await service?.getSecurityHistoryForDate(identifier, date)
  return history || null

  for await ( const service of servicesWithHistory) {
    const history = await service.getSecurityHistoryForDate(identifier, date)
    if (history) {
      return history
    }
  }
  return null
} 

const getIntradaySecurityHistoryForDate = async (identifier: SecurityIdentifier, date: Date, options?: IntradayOptions): Promise<SecurityHistory[]> => {

  const service = servicesWithIntraday.find(service => service.identifier === "alpha-vantage")
  const history = await service?.getIntradaySecurityHistoryForDate(identifier, date, options)
  return history || []
  
  // for await ( const service of servicesWithIntraday) {
  //   console.log("service", service.identifier)
  //   const history = await service.getIntradaySecurityHistoryForDate(identifier, date, options)
  //   console.log("history", history.length)
  //   if (history && history.length > 0) {
  //     return history
  //   }
  // }
  // return []
}

const getCalculatedSecurityHistoryForDateRange = async (identifier: SecurityIdentifier, holdings: number, startDate: Date, endDate: Date): Promise<SecurityHistory[]> => {

  const history = await getSecurityHistoryForDateRange(identifier, startDate, endDate)
    .then(history => {
      return history.map(h => ({
        ...h,
        open: h.open * holdings,
        high: h.high * holdings,
        low: h.low * holdings,
        close: h.close * holdings,
      }))
    })

  if (history.length === 0) {
    return []
  }

  return history

}

export const factory = () => {
  return {
    findSecurities,
    getCachedSecurities,
    createOrFindCachedSecurity,
    updateCachedSecurity,
    deleteCachedSecurity,
    getCachedSecurity,
    clearSearchHistory,
    getSearchStatistics,
    getSecurityHistoryForDateRange,
    getSecurityHistoryLiveForDateRange,
    getSecurityHistoryForDate,
    getIntradaySecurityHistoryForDate,
    getCalculatedSecurityHistoryForDateRange
  }
}
