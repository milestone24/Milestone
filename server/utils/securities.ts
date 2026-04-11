import { SecuritySearchResult, SecuritySelect } from "@shared/schema/securities";
import type { SecuritySelect as DBSecuritySelect } from "@server/db/schema/securities";

// Type helper to replace null with undefined in all properties
type NullToUndefined<T> = {
  [K in keyof T]: Exclude<T[K], null> | Extract<T[K], undefined>;
};

function valuesNullToUndefined<T extends object>(values: T): NullToUndefined<T> {
  const result: any = {};
  for (const key in values) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const value = values[key];
      result[key] = value === null ? undefined : value;
    }
  }
  return result;
}

// Maps a raw Drizzle DB security row (with nulls) to the application SecuritySelect type (with undefineds).
// This is the single point of null→undefined transformation for security DB reads.
export function mapDbSecurityToSelect(security: DBSecuritySelect): SecuritySelect {
  if (!security.createdAt) {
    throw new Error(`Security ${security.id} has no createdAt — data integrity violation`);
  }
  return {
    id: security.id,
    sourceIdentifier: security.sourceIdentifier,
    symbol: security.symbol,
    name: security.name,
    createdAt: security.createdAt,
    updatedAt: security.updatedAt ?? undefined,
    exchange: security.exchange ?? undefined,
    country: security.country ?? undefined,
    currency: security.currency ?? undefined,
    type: security.type ?? undefined,
    isin: security.isin ?? undefined,
    cusip: security.cusip ?? undefined,
    figi: security.figi ?? undefined,
  };
}

// Helper function to combine and deduplicate security results
export function combineSecurityResults(cached: SecuritySelect[], external: SecuritySearchResult[]): SecuritySearchResult[] {
  const symbolMap = new Map<string, SecuritySearchResult>();
  
  // Add external results first (they have priority for freshness)
  external.forEach(security => {
    if (security.symbol) { // EODHD format
      symbolMap.set(security.symbol, security);
    }
  });
  
  // Add cached results only if not already present from external.
  // TODO: valuesNullToUndefined is now redundant — SecuritySelect no longer contains nulls
  // since mapDbSecurityToSelect transforms them at the DB boundary. Can be removed.
  cached.forEach(security => {
    if (!symbolMap.has(security.symbol)) {
      if(security.symbol) {
        symbolMap.set(security.symbol, {
          ...valuesNullToUndefined(security),
          fromCache: true
        });
      }
    }
  });
  
  return Array.from(symbolMap.values());
}
