import { findSecurities as findSecuritiesOriginal } from "./search";
import { getSecurityHistoryForDateRange as getSecurityHistoryForDateRangeOriginal,
  getSecurityHistoryForDate as getSecurityHistoryForDateOriginal,
  getIntradaySecurityHistoryForDate as getIntradaySecurityHistoryForDateOriginal,
  getSecurityHistoryLiveForDateRange as getSecurityHistoryLiveForDateRangeOriginal } from "./history";
import { SecurityInfoService, IntradayOptions, SecurityIdentifier } from "../types";
import { SecuritySearchResult } from "@shared/schema"


export type EODHDSecurity = {
  Code: string;
  Country: string;
  Currency: string;
  Exchange: string;
  ISIN: string;
  Name: string;
  Type: string;
  previousClose: number;
  previousCloseDate: string;
}

const normalizeSecurityInfo = (security: EODHDSecurity): SecuritySearchResult => ({
  symbol: security.Code,
  name: security.Name,
  exchange: security.Exchange,
  country: security.Country,
  currency: security.Currency,
  type: security.Type,
  isin: security.ISIN,
  cusip: undefined,
  figi: undefined,
  fromCache: false,
  sourceIdentifier: "eodhd",
});   

export const factory = (): SecurityInfoService => ({
  identifier: "eodhd",
  name: "EODHD",
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