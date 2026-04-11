import { findSecurities as findSecuritiesOriginal } from "./search";
import { getSecurityHistoryForDateRange as getSecurityHistoryForDateRangeOriginal,
  getSecurityHistoryForDate as getSecurityHistoryForDateOriginal,
  getIntradaySecurityHistoryForDate as getIntradaySecurityHistoryForDateOriginal,
  getSecurityHistoryLiveForDateRange as getSecurityHistoryLiveForDateRangeOriginal } from "./history";
import { SecurityInfoService, IntradayOptions, SecurityIdentifier } from "../types";
import { SecuritySearchResult } from "@shared/schema"
import { EODHD_NAME, EODHD_SOURCE_IDENTIFIER } from "./const";


export type EODHDSecurity = {
  Code: string;
  Country: string | null;
  Currency: string | null;
  Exchange: string | null;
  ISIN: string | null;
  Name: string;
  Type: string | null;
  previousClose: number;
  previousCloseDate: string;
}

const normalizeSecurityInfo = (security: EODHDSecurity): SecuritySearchResult => ({
  symbol: security.Code,
  name: security.Name,
  exchange: security.Exchange ?? undefined,
  country: security.Country ?? undefined,
  currency: security.Currency ?? undefined,
  type: security.Type ?? undefined,
  isin: security.ISIN ?? undefined,
  cusip: undefined,
  figi: undefined,
  fromCache: false,
  sourceIdentifier: EODHD_SOURCE_IDENTIFIER,
});   

export const factory = (): SecurityInfoService => ({
  identifier: EODHD_SOURCE_IDENTIFIER,
  name: EODHD_NAME,
  canFindSecurities: true,
  findSecurities: async (securityIdentifiers: string[]) => {
    return findSecuritiesOriginal(securityIdentifiers)
      .then(securities => securities.map(normalizeSecurityInfo));
  },

  canGetSecurityHistoryForDateRange: true,
  getSecurityHistoryForDateRange: async (identifier: SecurityIdentifier, startDate: Date, endDate: Date) => {
    return getSecurityHistoryForDateRangeOriginal(identifier, startDate, endDate);
  },

  canGetSecurityHistoryLiveForDateRange: true,
  getSecurityHistoryLiveForDateRange: async (identifier: SecurityIdentifier, startDate: Date, endDate: Date) => {
    return getSecurityHistoryLiveForDateRangeOriginal(identifier, startDate, endDate);
  },

  canGetSecurityHistoryForDate: true,
  getSecurityHistoryForDate: async (identifier: SecurityIdentifier, date: Date) => {
    return getSecurityHistoryForDateOriginal(identifier, date);
  },

  canGetIntradaySecurityHistoryForDate: true,
  getIntradaySecurityHistoryForDate: async (identifier: SecurityIdentifier, date: Date, options?: IntradayOptions) => {
    return getIntradaySecurityHistoryForDateOriginal(identifier, date, options);
  },

  // canGetSecurityInfoBySymbol: true,
  // getSecurityInfoBySymbol: async (symbol: string) => {
  //   return getSecurityInfoBySymbol(symbol);
  // },
})