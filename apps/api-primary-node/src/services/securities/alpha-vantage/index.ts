import { SecurityInfoService, IntradayOptions, SecurityIdentifier } from "../types"
import { findSecurities } from "./search"
import { getSecurityHistoryForDateRange, getSecurityHistoryForDate, getIntradaySecurityHistoryForDate } from "./history"
import { ALPHA_VANTAGE_SOURCE_IDENTIFIER, ALPHA_VANTAGE_NAME } from "./const"

export const factory = (): SecurityInfoService => ({
  identifier: ALPHA_VANTAGE_SOURCE_IDENTIFIER,
  name: ALPHA_VANTAGE_NAME,
  canFindSecurities: true,
  findSecurities: async (securityIdentifiers: string[]) => {
    return findSecurities(securityIdentifiers)
  },

  canGetSecurityHistoryLiveForDateRange: true,
  getSecurityHistoryLiveForDateRange: async (identifier: SecurityIdentifier, startDate: Date, endDate: Date) => {
    throw new Error("Not implemented")
  },

  canGetSecurityHistoryForDateRange: true,
  getSecurityHistoryForDateRange: async (identifier: SecurityIdentifier, startDate: Date, endDate: Date) => {
    return getSecurityHistoryForDateRange(identifier, startDate, endDate);
  },

  canGetSecurityHistoryForDate: true,
  getSecurityHistoryForDate: async (identifier: SecurityIdentifier, date: Date) => {
    return getSecurityHistoryForDate(identifier, date);
  },

  canGetIntradaySecurityHistoryForDate: true,
  getIntradaySecurityHistoryForDate: async (identifier: SecurityIdentifier, date: Date, options?: IntradayOptions) => {
    return getIntradaySecurityHistoryForDate(identifier, date, options);
  },
})