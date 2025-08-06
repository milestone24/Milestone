import { SecuritySearchResult } from "@shared/schema";
import { getSecurityHistoryLiveForDateRange } from "./eodhd/history";

export type SecurityHistory = {
  symbol: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type IntradayInterval = '15min' | '30min' | '60min'

export interface IntradayOptions {
  interval?: IntradayInterval;
}

export interface SecurityIdentifier {
  symbol: string;
  exchange?: string;
}

export type SecurityInfoService = {
  name: string;
  identifier: string;
  canFindSecurities: boolean;
  findSecurities: (securityIdentifiers: string[]) => Promise<SecuritySearchResult[]>;

  canGetSecurityHistoryForDateRange: boolean;
  /** Gets the price history for a given symbol and date range  */
  getSecurityHistoryForDateRange: (identifier: SecurityIdentifier, startDate: Date, endDate: Date) => Promise<SecurityHistory[]>;

  canGetSecurityHistoryLiveForDateRange: boolean;
  getSecurityHistoryLiveForDateRange: (
    identifier: SecurityIdentifier, 
    startDate: Date, 
    endDate: Date
  ) => Promise<SecurityHistory[]>
  
  canGetSecurityHistoryForDate: boolean;
  /** Gets the price history for a given symbol and date */
  getSecurityHistoryForDate: (identifier: SecurityIdentifier, date: Date) => Promise<SecurityHistory>;

  canGetIntradaySecurityHistoryForDate: boolean;
  /** Gets the intraday price history for a given symbol and date */
  getIntradaySecurityHistoryForDate: (identifier: SecurityIdentifier, date: Date, options?: IntradayOptions) => Promise<SecurityHistory[]>;

  // canGetSecurityInfoBySymbol: boolean;
  // getSecurityInfoBySymbol: (symbol: string) => Promise<SecurityInfo>;

  
};