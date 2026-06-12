# EODHD Exchange Codes Reference

This document provides a comprehensive reference for EODHD exchange codes used in API calls and data responses.

## Source
Based on the [EODHD Supported Exchanges documentation](https://eodhd.com/financial-apis/list-supported-exchanges).

## Dynamic Exchange List API

EODHD provides a dedicated API endpoint to get the full list of supported exchanges dynamically:

**API Endpoint**: [EODHD Exchanges API](https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours)

This endpoint provides:
- Complete list of supported exchanges
- Trading hours for each exchange
- Market holidays
- Exchange metadata

**Benefits of using the API over hardcoded lists:**
- Always up-to-date exchange information
- Includes trading hours and holidays
- Reduces maintenance overhead
- Handles new exchanges automatically

## Exchange Codes Table

| Exchange Name | EODHD Code | MIC Code | Description |
|---------------|------------|----------|-------------|
| USA Stocks | US | XNAS, XNYS | NASDAQ and NYSE |
| London Exchange | LSE | XLON | London Stock Exchange |
| Toronto Exchange | TO | XTSE | Toronto Stock Exchange |
| NEO Exchange | NEO | NEOE | NEO Exchange |
| Berlin Exchange | BE | XBER | Berlin Stock Exchange |
| Hamburg Exchange | HM | XHAM | Hamburg Stock Exchange |
| XETRA Exchange | XETRA | XETR | Deutsche Börse XETRA |
| Dusseldorf Exchange | DU | XDUS | Dusseldorf Stock Exchange |
| Frankfurt Exchange | F | XFRA | Frankfurt Stock Exchange |
| Hanover Exchange | HA | XHAN | Hanover Stock Exchange |
| Munich Exchange | MU | XMUN | Munich Stock Exchange |
| Stuttgart Exchange | STU | XSTU | Stuttgart Stock Exchange |
| Luxembourg Stock Exchange | LU | XLUX | Luxembourg Stock Exchange |
| Vienna Exchange | VI | XWBO | Vienna Stock Exchange |
| Euronext Paris | PA | XPAR | Euronext Paris |
| Euronext Brussels | BR | XBRU | Euronext Brussels |
| Euronext Lisbon | LS | XLIS | Euronext Lisbon |
| Swiss Exchange | VX | XSWX | SIX Swiss Exchange |
| Euronext Amsterdam | AS | XAMS | Euronext Amsterdam |
| SIX Swiss Exchange | SW | XSWX | SIX Swiss Exchange |
| Madrid Exchange | MC | BMEX | Bolsa de Madrid |
| Irish Exchange | IR | XDUB | Irish Stock Exchange |
| Iceland Exchange | IC | XICE | Iceland Stock Exchange |
| Helsinki Exchange | HE | XHEL | Helsinki Stock Exchange |
| Oslo Stock Exchange | OL | XOSL | Oslo Stock Exchange |
| Stockholm Exchange | ST | XSTO | Stockholm Stock Exchange |
| Copenhagen Exchange | CO | XCSE | Copenhagen Stock Exchange |
| Tel Aviv Exchange | TA | XTAE | Tel Aviv Stock Exchange |
| Hong Kong Exchange | HK | XHKG | Hong Kong Stock Exchange |
| Korea Stock Exchange | KO | XKRX | Korea Stock Exchange |
| KOSDAQ | KQ | XKOS | KOSDAQ |
| Philippine Stock Exchange | PSE | XPHS | Philippine Stock Exchange |
| Budapest Stock Exchange | BUD | XBUD | Budapest Stock Exchange |
| Warsaw Stock Exchange | WAR | XWAR | Warsaw Stock Exchange |
| Singapore Exchange | SG | XSES | Singapore Exchange |
| Bombay Exchange | BSE | XBOM | Bombay Stock Exchange |
| Shenzhen Exchange | SHE | XSHE | Shenzhen Stock Exchange |
| Chilean Stock Exchange | SN | XSGO | Santiago Stock Exchange |
| Athens Exchange | AT | ASEX | Athens Stock Exchange |
| Jakarta Exchange | JK | XIDX | Indonesia Stock Exchange |
| Johannesburg Exchange | JSE | XJSE | Johannesburg Stock Exchange |
| Thailand Exchange | BK | XBKK | Stock Exchange of Thailand |
| Saudi Arabia Exchange | SR | XSAU | Saudi Stock Exchange |
| NSE (India) | NSE | XNSE | National Stock Exchange of India |
| Karachi Stock Exchange | KAR | XKAR | Karachi Stock Exchange |
| Australia Exchange | AU | XASX | Australian Securities Exchange |
| Shanghai Exchange | SHG | XSHG | Shanghai Stock Exchange |
| Colombo Stock Exchange | CM | XCOL | Colombo Stock Exchange |
| Vietnam Stocks | VN | HSTC | Ho Chi Minh Stock Exchange |
| Kuala Lumpur Exchange | KLSE | XKLS | Bursa Malaysia |
| Bucharest Stock Exchange | RO | XBSE | Bucharest Stock Exchange |
| Sao Paolo Exchange | SA | BVMF | B3 (Brazilian Stock Exchange) |
| Buenos Aires Exchange | BA | XBUE | Buenos Aires Stock Exchange |
| Mexican Exchange | MX | XMEX | Mexican Stock Exchange |
| London IL | IL | XLON | London International |
| Zagreb Stock Exchange | ZSE | XZAG | Zagreb Stock Exchange |
| Europe Fund Virtual Exchange | EUFUND | | European Fund Exchange |
| Taiwan Exchange | TW | XTAI | Taiwan Stock Exchange |
| Bolsa de Valores de Lima | LIM | XLIM | Lima Stock Exchange |
| Government Bonds | GBOND | | Government Bonds |
| Money Market Virtual Exchange | MONEY | | Money Market |
| Cryptocurrencies | CC | CRYP | Cryptocurrency Exchange |
| Bond Virtual Exchange | BOND | | Bond Exchange |
| MICEX Moscow Russia | MCX | | Moscow Exchange |
| Taiwan OTC Exchange | TWO | ROCO | Taiwan OTC Exchange |
| FOREX | FOREX | CDSL | Foreign Exchange |
| Istanbul Stock Exchange | IS | XIST | Borsa Istanbul |

## Usage in API Calls

### Intraday API
For intraday data, EODHD uses the format: `{symbol}.{exchange_code}`

Example:
- `AAPL.US` - Apple Inc. on US exchanges
- `TSCO.LSE` - Tesco on London Stock Exchange
- `RY.TO` - Royal Bank of Canada on Toronto Stock Exchange

### Search API
When searching for securities, the `Exchange` field in search results contains these codes.

### End-of-Day API
For historical data, the same exchange code format is used.

## Important Notes

1. **API Recommendation**: EODHD recommends using their Exchanges API to get the full list of supported exchanges dynamically rather than hardcoding these values.

2. **MIC Codes**: Market Identifier Codes (MIC) are standardized exchange identifiers used in financial markets.

3. **Virtual Exchanges**: Some exchanges (like EUFUND, MONEY, BOND) are virtual exchanges for specific asset types.

4. **Multiple MIC Codes**: Some exchanges have multiple MIC codes (e.g., US has both XNAS and XNYS for NASDAQ and NYSE respectively).

## When to Use API vs Hardcoded List

### Use EODHD Exchanges API when:
- Building production applications that need to stay current
- Requiring trading hours and market holiday information
- Supporting a wide range of international exchanges
- Wanting to reduce maintenance overhead
- Need to handle new exchanges automatically

### Use Hardcoded List when:
- Building prototypes or proof-of-concepts
- Working with a limited set of well-known exchanges
- API rate limits are a concern
- Offline functionality is required
- Simple applications with basic exchange support

### Hybrid Approach:
Consider implementing a hybrid approach:
1. Use hardcoded list as fallback
2. Load dynamic exchange data on startup
3. Cache exchange information with periodic refresh
4. Graceful degradation if API is unavailable

## Related Documentation

- [Exchange Handling for Intraday Functions](exchange-handling.md)
- [EODHD Service README](../eodhd/README.md)
- [Main Securities Service README](../README.md) 