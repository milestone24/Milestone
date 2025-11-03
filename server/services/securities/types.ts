import {
  AssetValueMetadata,
  DecimalValueString,
  SecuritySearchResult,
} from "@shared/schema";

export type WithSourceIdentifier<T> = T & {
  sourceIdentifier: string;
};

export type SecurityHistory = WithSourceIdentifier<{
  symbol: string;
  exchange: string;
  date: Date;
  open: DecimalValueString;
  high: DecimalValueString;
  low: DecimalValueString;
  close: DecimalValueString;
}>;

export type IntradayInterval = "15min" | "30min" | "60min";

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
  findSecurities: (
    securityIdentifiers: string[]
  ) => Promise<SecuritySearchResult[]>;

  canGetSecurityHistoryForDateRange: boolean;
  /** Gets the price history for a given symbol and date range  */
  getSecurityHistoryForDateRange: (
    identifier: SecurityIdentifier,
    startDate: Date,
    endDate: Date
  ) => Promise<SecurityHistory[]>;

  canGetSecurityHistoryLiveForDateRange: boolean;
  getSecurityHistoryLiveForDateRange: (
    identifier: SecurityIdentifier,
    startDate: Date,
    endDate: Date
  ) => Promise<SecurityHistory[]>;

  canGetSecurityHistoryForDate: boolean;
  /** Gets the price history for a given symbol and date */
  getSecurityHistoryForDate: (
    identifier: SecurityIdentifier,
    date: Date
  ) => Promise<SecurityHistory>;

  canGetIntradaySecurityHistoryForDate: boolean;
  /** Gets the intraday price history for a given symbol and date */
  getIntradaySecurityHistoryForDate: (
    identifier: SecurityIdentifier,
    date: Date,
    options?: IntradayOptions
  ) => Promise<SecurityHistory[]>;

  // canGetSecurityInfoBySymbol: boolean;
  // getSecurityInfoBySymbol: (symbol: string) => Promise<SecurityInfo>;
};

export type SecurityContext = {
  securityId: string;
  startDate: Date;
};

// Minimal interface for injected securities
export interface AssetSecurity {
  securityId: string;
  symbol: string;
  exchange?: string;
  //shareHolding: number;
  startDate: Date;
}

// Simplified return type
export interface AssetValueResult {
  value: DecimalValueString;
  entryMethod: "calculated";
  valueDate: Date;
  metadata: AssetValueMetadata;
}
