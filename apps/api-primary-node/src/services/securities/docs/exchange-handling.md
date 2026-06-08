# Exchange Handling for Intraday Functions

## Overview

This document records the discussion and decision-making process for handling exchange suffixes in the `getIntradaySecurityHistoryForDate` functions, particularly for EODHD which requires exchange information in the API URL.

## Problem Statement

The current implementation has a hardcoded `.US` suffix for EODHD intraday API calls:

```typescript
const url = `https://eodhd.com/api/intraday/${symbol}.US?api_token=${apiKey}&interval=${interval}&from=${fromTimestamp}&to=${toTimestamp}&fmt=json`
```

This assumes all symbols are US stocks, which is incorrect for international securities. We need a proper way to handle exchange information for intraday data retrieval.

## Current State Analysis

### Provider Exchange Information

**EODHD Search Results:**
- Include `Exchange` field (e.g., "US", "LSE", "TSE", "ASX")
- Example: `{ Code: "AAPL", Exchange: "US", Name: "Apple Inc.", ... }`

**EODHD Exchange Codes Reference:**
Based on the [EODHD Supported Exchanges documentation](https://eodhd.com/financial-apis/list-supported-exchanges), EODHD uses specific exchange codes:

| Exchange Name | EODHD Code | MIC Code |
|---------------|------------|----------|
| USA Stocks | US | XNAS, XNYS |
| London Exchange | LSE | XLON |
| Toronto Exchange | TO | XTSE |
| NEO Exchange | NEO | NEOE |
| Berlin Exchange | BE | XBER |
| Hamburg Exchange | HM | XHAM |
| XETRA Exchange | XETRA | XETR |
| Dusseldorf Exchange | DU | XDUS |
| Frankfurt Exchange | F | XFRA |
| Hanover Exchange | HA | XHAN |
| Munich Exchange | MU | XMUN |
| Stuttgart Exchange | STU | XSTU |
| Luxembourg Stock Exchange | LU | XLUX |
| Vienna Exchange | VI | XWBO |
| Euronext Paris | PA | XPAR |
| Euronext Brussels | BR | XBRU |
| Euronext Lisbon | LS | XLIS |
| Swiss Exchange | VX | XSWX |
| Euronext Amsterdam | AS | XAMS |
| SIX Swiss Exchange | SW | XSWX |
| Madrid Exchange | MC | BMEX |
| Irish Exchange | IR | XDUB |
| Iceland Exchange | IC | XICE |
| Helsinki Exchange | HE | XHEL |
| Oslo Stock Exchange | OL | XOSL |
| Stockholm Exchange | ST | XSTO |
| Copenhagen Exchange | CO | XCSE |
| Tel Aviv Exchange | TA | XTAE |
| Hong Kong Exchange | HK | XHKG |
| Korea Stock Exchange | KO | XKRX |
| KOSDAQ | KQ | XKOS |
| Philippine Stock Exchange | PSE | XPHS |
| Budapest Stock Exchange | BUD | XBUD |
| Warsaw Stock Exchange | WAR | XWAR |
| Singapore Exchange | SG | XSES |
| Bombay Exchange | BSE | XBOM |
| Shenzhen Exchange | SHE | XSHE |
| Chilean Stock Exchange | SN | XSGO |
| Athens Exchange | AT | ASEX |
| Jakarta Exchange | JK | XIDX |
| Johannesburg Exchange | JSE | XJSE |
| Thailand Exchange | BK | XBKK |
| Saudi Arabia Exchange | SR | XSAU |
| NSE (India) | NSE | XNSE |
| Karachi Stock Exchange | KAR | XKAR |
| Australia Exchange | AU | XASX |
| Shanghai Exchange | SHG | XSHG |
| Colombo Stock Exchange | CM | XCOL |
| Vietnam Stocks | VN | HSTC |
| Kuala Lumpur Exchange | KLSE | XKLS |
| Bucharest Stock Exchange | RO | XBSE |
| Sao Paolo Exchange | SA | BVMF |
| Buenos Aires Exchange | BA | XBUE |
| Mexican Exchange | MX | XMEX |
| London IL | IL | XLON |
| Zagreb Stock Exchange | ZSE | XZAG |
| Europe Fund Virtual Exchange | EUFUND | |
| Taiwan Exchange | TW | XTAI |
| Bolsa de Valores de Lima | LIM | XLIM |
| Government Bonds | GBOND | |
| Money Market Virtual Exchange | MONEY | |
| Cryptocurrencies | CC | CRYP |
| Bond Virtual Exchange | BOND | |
| MICEX Moscow Russia | MCX | |
| Taiwan OTC Exchange | TWO | ROCO |
| FOREX | FOREX | CDSL |
| Istanbul Stock Exchange | IS | XIST |

**Note**: For API usage, EODHD recommends using their [Exchanges API](https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours) to get the full list of supported exchanges dynamically. This provides trading hours, market holidays, and always up-to-date exchange information.

**Alpha Vantage Search Results:**
- Do NOT include separate exchange field (`exchange: undefined`)
- Search results include: symbol, name, type, region, marketOpen, marketClose, timezone, currency, matchScore
- **CRITICAL DISCOVERY**: Exchange information is embedded in the symbol field as suffixes
- Example US symbol:
  ```json
  {
    "1. symbol": "AAPL",
    "2. name": "Apple Inc",
    "3. type": "Equity", 
    "4. region": "United States",
    "5. marketOpen": "09:30",
    "6. marketClose": "16:00", 
    "7. timezone": "UTC-04",
    "8. currency": "USD",
    "9. matchScore": "1.0000"
  }
  ```
- Example international symbols with exchange suffixes:
  ```json
  {
    "1. symbol": "AAPL34.SAO",  // Brazil/Sao Paolo (.SAO)
    "2. name": "Apple Inc",
    "3. type": "Equity",
    "4. region": "Brazil/Sao Paolo",
    "8. currency": "BRL"
  }
  {
    "1. symbol": "APC.DEX",     // XETRA (.DEX)
    "2. name": "Apple Inc", 
    "3. type": "Equity",
    "4. region": "XETRA",
    "8. currency": "EUR"
  }
  {
    "1. symbol": "AAPL.TRT",    // Toronto (.TRT)
    "2. name": "Apple CDR (CAD Hedged)",
    "3. type": "Equity",
    "4. region": "Toronto",
    "8. currency": "CAD"
  }
  ```
- **Key Finding**: Alpha Vantage embeds exchange codes in symbol suffixes, not as separate fields

### Current Implementation Issues

1. **Hardcoded Exchange**: All EODHD intraday calls use `.US` suffix
2. **Symbol Ambiguity**: Same symbol might exist on multiple exchanges
3. **Alpha Vantage Exchange Extraction**: Need to extract exchange info from symbol suffixes
4. **Exchange Mapping**: Need to map Alpha Vantage suffixes to our internal exchange codes
5. **Symbol Normalization**: Need consistent approach for handling symbols across providers

### Alpha Vantage Exchange Handling Implications

**CRITICAL DISCOVERY**: Alpha Vantage embeds exchange information in symbol suffixes, not as separate fields.

**Implications for Exchange Handling:**
- **EODHD**: Uses explicit exchange field from search results to construct proper intraday URLs
- **Alpha Vantage**: Exchange information is embedded in symbol suffixes (e.g., `.SAO`, `.DEX`, `.TRT`)
- **Symbol Resolution**: Alpha Vantage symbols can be disambiguated by their exchange suffixes
- **Intraday Calls**: Alpha Vantage intraday calls use the full symbol including exchange suffix

**Exchange Suffix Examples from "APPL" Search:**
- `AAPL` - US market (no suffix, primary exchange)
- `AAPL34.SAO` - Brazil/Sao Paolo exchange (`.SAO` suffix)
- `APC.DEX` - XETRA exchange (`.DEX` suffix)
- `AAPL.TRT` - Toronto exchange (`.TRT` suffix)
- `500014.BSE` - India/Bombay exchange (`.BSE` suffix)
- `48T.FRK` - Frankfurt exchange (`.FRK` suffix)
- `603020.SHH` - Shanghai exchange (`.SHH` suffix)

**Updated Questions to Resolve:**
1. How do we map Alpha Vantage exchange suffixes to our internal exchange codes?
2. Should we extract and normalize exchange information from symbol suffixes?
3. How do we handle symbols that exist on multiple exchanges?
4. What's the best approach for symbol normalization across providers?

### Implementation Considerations

**EODHD Exchange API Integration:**
- **Dynamic Exchange Loading**: Consider using EODHD's Exchanges API to load exchange information dynamically
- **Caching Strategy**: Cache exchange data to avoid repeated API calls
- **Fallback Mechanism**: Use hardcoded exchange codes as fallback if API is unavailable
- **Trading Hours**: Leverage trading hours data for better error handling and user experience

**Benefits of Dynamic Exchange Loading:**
- Always up-to-date exchange information
- Automatic support for new exchanges
- Reduced maintenance overhead
- Better error handling with trading hours data

## Options Considered

### Option 1: String with Exchange Suffix
```typescript
// Examples: "AAPL.US", "AAPL.LSE", "AAPL.TSE"
getIntradaySecurityHistoryForDate("AAPL.US", date, options)
```

**Pros:**
- Simple string interface
- Clear and explicit
- Matches EODHD API format

**Cons:**
- Need to handle existing dots in symbols (e.g., "BRK.A" vs "BRK.A.US")
- Alpha Vantage exchange info is embedded in symbol suffixes (e.g., "AAPL34.SAO")
- Requires parsing logic to extract symbol and exchange
- Risk of double-suffixing (e.g., "AAPL.US.US")
- Ambiguous for symbols with existing dots
- Need to handle Alpha Vantage's embedded exchange suffixes

### Option 2: Object with Name and Exchange Fields
```typescript
interface SecurityIdentifier {
  symbol: string;
  exchange?: string;
}

getIntradaySecurityHistoryForDate({ symbol: "AAPL", exchange: "US" }, date, options)
```

**Pros:**
- Clear separation of symbol and exchange
- No parsing required for EODHD (uses explicit exchange field)
- Type-safe
- Handles missing exchange gracefully
- Matches existing `SecuritySearchResult` structure
- Can extract Alpha Vantage exchange info from symbol suffixes
- Consistent interface across both providers

**Cons:**
- Breaking change to existing API
- More complex interface
- Need to update all callers

### Option 3: Object with Dynamic Suffix Support
```typescript
interface SecurityIdentifier {
  symbol: string;
  exchange?: string;
  suffix?: string; // Allow custom suffix override
}

getIntradaySecurityHistoryForDate({ symbol: "AAPL", exchange: "US" }, date, options)
// or
getIntradaySecurityHistoryForDate({ symbol: "AAPL", suffix: "NASDAQ" }, date, options)
```

**Pros:**
- Most flexible
- Handles edge cases
- Future-proof
- Can support both exchange codes and custom suffixes

**Cons:**
- Most complex
- Breaking change
- Potential confusion between exchange and suffix
- Over-engineering for current needs

## Recommended Solution: Option 2

### Rationale

1. **Type Safety**: Clear separation prevents parsing errors and symbol/exchange confusion
2. **Provider Compatibility**: Works well with EODHD's explicit exchange field from search results
3. **Alpha Vantage Support**: Can extract exchange info from symbol suffixes (e.g., "AAPL34.SAO" → exchange: "SAO")
4. **Graceful Degradation**: Alpha Vantage can use `exchange: undefined` for US symbols (no suffix)
5. **Future-Proof**: Easy to extend with additional fields if needed
6. **Consistent**: Matches the `SecuritySearchResult` structure we already have
7. **Simple**: Straightforward implementation with clear exchange handling logic
8. **Unified Interface**: Both providers can now provide exchange information consistently

### Proposed Interface

```typescript
export interface SecurityIdentifier {
  symbol: string;
  exchange?: string;
}

// Updated function signature
getIntradaySecurityHistoryForDate(
  identifier: SecurityIdentifier, 
  date: Date, 
  options?: IntradayOptions
): Promise<SecurityHistory[]>
```

### Implementation Strategy

1. **Create new interface** in `types.ts`
2. **Update function signatures** in both EODHD and Alpha Vantage modules
3. **Add backward compatibility** (optional overload for string symbols)
4. **Update URL builders** to handle the new format
5. **Update tests** to use new interface
6. **Update documentation** to reflect changes
7. **Create Alpha Vantage exchange suffix mapping** for symbol parsing

### Alpha Vantage Exchange Suffix Mapping

Based on our comprehensive symbol search tests, we discovered the following exchange suffix patterns:

| Alpha Vantage Suffix | Exchange/Market | Example Symbol | Currency | Notes |
|---------------------|-----------------|----------------|----------|-------|
| (no suffix) | US (primary) | `AAPL` | USD | US primary market |
| `.LON` | London Stock Exchange | `VWRL.LON` | GBP | London listings |
| `.AMS` | Amsterdam Stock Exchange | `VWRL.AMS` | EUR | Euronext Amsterdam |
| `.PAR` | Paris Stock Exchange | `ABCA.PAR` | EUR | Euronext Paris |
| `.SHZ` | Shenzhen Stock Exchange | `301510.SHZ` | CNY | Shenzhen Stock Exchange |
| `.SAO` | Brazil/Sao Paolo | `AAPL34.SAO` | BRL | Brazilian Stock Exchange |
| `.DEX` | XETRA | `APC.DEX` | EUR | Deutsche Börse XETRA |
| `.TRT` | Toronto | `AAPL.TRT` | CAD | Toronto Stock Exchange |
| `.BSE` | India/Bombay | `500014.BSE` | INR | Bombay Stock Exchange |
| `.FRK` | Frankfurt | `48T.FRK` | EUR | Frankfurt Stock Exchange |
| `.SHH` | Shanghai | `603020.SHH` | CNY | Shanghai Stock Exchange |

**Implementation Notes:**
- US symbols have no suffix (e.g., `AAPL`, `MSFT`)
- International symbols include exchange suffixes
- Alpha Vantage search API does NOT include US class shares (BRK.A, BAC.PR, etc.)
- **Critical**: No suffix = US market (this is reliable for Alpha Vantage search results)

### Key Discovery: Alpha Vantage Search API Behavior

Our testing revealed that:
1. **International symbols always have exchange suffixes** (e.g., `.LON`, `.SAO`, `.DEX`)
2. **US class shares and preferred shares are NOT included** in Alpha Vantage search results
3. **US class shares use hyphens, not dots** (e.g., `BRK-A`, `BRK-B`, not `BRK.A`, `BRK.B`)

### Critical Issue: Distinguishing Exchange Suffixes from Symbol Names

**The Problem**: When a symbol has a dot character (like `ABC.C1`), we need to determine if the characters after the dot are:
1. **Part of the symbol name** (e.g., `ABC.C1` is a US stock where `.C1` is part of the symbol)
2. **An exchange suffix** (e.g., `ABC.C1` is an international stock where `.C1` is an exchange code)

**Our Approach**: 
1. **Symbols without dots** (like `AAPL`) → Assume US market ✅
2. **Symbols with known exchange suffixes** (like `VWRL.LON`) → Identify the exchange ✅
3. **Symbols with unknown suffixes** (like `ABC.C1`) → Return `undefined` - we cannot distinguish between US symbol with dot vs unknown exchange ❌

**Current Status**: We can identify known exchange suffixes, but we cannot definitively determine if an unknown suffix (like `.C1`) is part of a US symbol name or an unrecognized exchange code.

### Backward Compatibility Consideration

We could provide an overload for string symbols that assumes US exchange:

```typescript
// Overload for string symbols (assumes US exchange)
getIntradaySecurityHistoryForDate(symbol: string, date: Date, options?: IntradayOptions): Promise<SecurityHistory[]>

// New interface for explicit exchange handling
getIntradaySecurityHistoryForDate(identifier: SecurityIdentifier, date: Date, options?: IntradayOptions): Promise<SecurityHistory[]>
```

This would allow existing code to continue working while enabling new code to specify exchanges explicitly.

## Impact Assessment

### Breaking Changes
- Function signatures will change
- All callers need to be updated
- Tests need to be modified

### Benefits
- Proper exchange handling for international securities
- Type-safe interface
- Consistent with search result structure
- Future-proof for additional exchange-related features

### Migration Path
1. Implement new interface alongside existing one
2. Update internal code to use new interface
3. Deprecate old interface
4. Remove old interface in future version

## Related Documentation

- [Interval Decision Documentation](interval-decision.md) - Related to intraday functionality
- [Main Securities Service README](../README.md)
- [EODHD Service README](../eodhd/README.md)
- [Alpha Vantage Service README](../alpha-vantage/README.md)

## Next Steps

1. Implement the `SecurityIdentifier` interface
2. Update function signatures in both providers
3. Add backward compatibility overloads
4. Update URL builders and tests
5. Update documentation
6. Test with various exchange scenarios
7. Implement Alpha Vantage exchange suffix extraction logic
8. Create comprehensive exchange mapping between providers

## Summary of Key Findings

### Alpha Vantage Exchange Discovery
Our investigation revealed that **Alpha Vantage embeds exchange information in symbol suffixes**, not as separate fields. This was discovered through testing the search API with "APPL" which returned multiple Apple Inc. listings across different exchanges:

- **US Market**: `AAPL` (no suffix)
- **Brazil**: `AAPL34.SAO` (`.SAO` suffix)
- **XETRA**: `APC.DEX` (`.DEX` suffix)
- **Toronto**: `AAPL.TRT` (`.TRT` suffix)
- **India**: `500014.BSE` (`.BSE` suffix)
- **Frankfurt**: `48T.FRK` (`.FRK` suffix)
- **Shanghai**: `603020.SHH` (`.SHH` suffix)

### Unified Exchange Handling
Both providers can now provide exchange information:
- **EODHD**: Explicit `Exchange` field in search results
- **Alpha Vantage**: Exchange suffixes embedded in symbol field

### Implementation Strategy
The recommended approach is **Option 2: Object with Name and Exchange Fields** which provides:
- Type-safe interface
- Clear separation of symbol and exchange
- Consistent handling across both providers
- Graceful degradation for missing exchange information
- Future-proof design for additional exchange-related features 