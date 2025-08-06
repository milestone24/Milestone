
# Securities Service

This service module handles everything related to investment securities resolution and search functionality.

## API Providers

The service integrates with multiple financial data providers to resolve securities information:

- **EODHD** - Primary provider with comprehensive security data
- **Alpha Vantage** - Secondary provider for additional coverage

Each API service is responsible for:
- Searching for securities on financial indexes by various identifiers (symbols, names, ISINs)
- Providing normalized security information
- Retrieving historical price data for securities
- Handling API errors and rate limiting gracefully

## Service Architecture

The service uses a fallback pattern where:
1. EODHD is queried first for securities
2. If no results are found, Alpha Vantage is queried
3. Results are normalized to a consistent `SecuritySearchResult` format

### Module Structure

```
server/services/securities/
├── alpha-vantage/          # Alpha Vantage API integration
│   ├── search.ts          # Security search functionality
│   ├── history.ts         # Historical data retrieval
│   ├── index.ts           # Service factory
│   └── README.md          # Provider-specific documentation
├── eodhd/                 # EODHD API integration
│   ├── search.ts          # Security search functionality
│   ├── history.ts         # Historical data retrieval
│   ├── index.ts           # Service factory
│   └── README.md          # Provider-specific documentation
├── utils/                 # Securities-specific utilities
│   ├── security-history-mapper.ts      # Data mapping utilities
│   ├── provider-url-builders.ts        # URL construction utilities
│   └── provider-response-validation.ts # Response validation utilities
├── types.ts               # Shared type definitions
├── index.ts               # Main service entry point
└── README.md              # This documentation
```

## Utility Functions

The service leverages both general-purpose and securities-specific utilities to ensure code reusability and maintainability.

### General-Purpose Utilities (`server/utils/`)

- **`date-validation.ts`** - Date validation and formatting utilities
- **`api-key-validation.ts`** - API key validation utilities
- **`http-client.ts`** - Standardized HTTP request handling
- **`error-handling.ts`** - Consistent error handling patterns
- **`response-validation.ts`** - API response validation utilities

### Securities-Specific Utilities (`server/services/securities/utils/`)

- **`security-history-mapper.ts`** - Maps API responses to `SecurityHistory` format
- **`provider-url-builders.ts`** - Constructs provider-specific API URLs
- **`provider-response-validation.ts`** - Validates provider-specific API responses

## Search Limiting

The service implements configurable search limiting to prevent API abuse and manage rate limits:

### Features:
- **Configurable Limits**: Set maximum searches per identifier via environment variables
- **Time-Based Expiration**: Optional expiration of search counts after a configurable time period
- **In-Memory Tracking**: Fast, efficient tracking of search history
- **Management Functions**: Clear history and monitor search statistics

### Configuration Options:
- **EODHD Provider:**
  - `EODHD_MAX_SEARCHES`: Maximum searches per identifier (default: 20)
  - `EODHD_SEARCH_EXPIRATION_HOURS`: Hours before search count resets (default: 24)
  - `EODHD_ENABLE_SEARCH_EXPIRATION`: Enable/disable expiration (default: false)
- **Alpha Vantage Provider:**
  - `ALPHA_VANTAGE_MAX_SEARCHES`: Maximum searches per identifier (default: 10)
  - `ALPHA_VANTAGE_SEARCH_EXPIRATION_HOURS`: Hours before search count resets (default: 24)
  - `ALPHA_VANTAGE_ENABLE_SEARCH_EXPIRATION`: Enable/disable expiration (default: false)

### Behavior:
- **Per-Provider Tracking**: Each identifier is tracked separately for EODHD and Alpha Vantage
- **Successful Calls Only**: Counts only increment on successful API calls (not on failures)
- **No Results ≠ Failure**: Empty results from valid searches still count as successful calls
- **Fallback Logic**: If EODHD reaches limit, Alpha Vantage can still be searched
- **Expiration**: Each provider can have different expiration settings
- **Search history is cleared on server restart (TODO: persist to database/Redis)**

## Error Handling

Both API providers implement comprehensive error handling using shared utility functions:

### Common Error Scenarios Handled:
- **Missing API Keys**: Graceful degradation with warning logs
- **HTTP Errors**: 401, 403, 429, 500+ status codes
- **API Error Responses**: Invalid tokens, authentication failures
- **Network Errors**: Connection timeouts, DNS failures
- **Rate Limiting**: API quota exceeded warnings
- **Invalid Data**: Malformed responses filtered out
- **Empty Results**: Handled gracefully
- **Invalid Dates**: Date validation with clear error messages

### Error Recovery:
- Services continue operation even when individual APIs fail
- Detailed logging for debugging and monitoring
- Fallback to alternative providers when available
- Consistent error handling patterns across all modules

## Configuration

Set the following environment variables:

```bash
# API Keys
EODHD_API_KEY=your_eodhd_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here

# Search Limiting Configuration
# EODHD Provider
EODHD_MAX_SEARCHES=20                         # Maximum searches per identifier (default: 20)
EODHD_SEARCH_EXPIRATION_HOURS=24              # Hours before search count resets (default: 24)
EODHD_ENABLE_SEARCH_EXPIRATION=true           # Enable/disable expiration (default: false)

# Alpha Vantage Provider
ALPHA_VANTAGE_MAX_SEARCHES=10                 # Maximum searches per identifier (default: 10)
ALPHA_VANTAGE_SEARCH_EXPIRATION_HOURS=24      # Hours before search count resets (default: 24)
ALPHA_VANTAGE_ENABLE_SEARCH_EXPIRATION=true   # Enable/disable expiration (default: false)
```

## Usage

### Security Search

```typescript
import { findSecurities } from './index'

const results = await findSecurities(['AAPL', 'GOOGL', 'MSFT'])
```

### Search Limiting Management

The service includes configurable search limiting to prevent API abuse:

```typescript
import { 
  findProviderSecurities, 
  clearSearchHistory, 
  getSearchStatistics 
} from './index'

// Clear search history for a specific identifier
clearSearchHistory('AAPL')

// Clear all search history
clearSearchHistory()

// Get current search statistics
const stats = getSearchStatistics()
console.log(`Tracking ${stats.totalIdentifiers} identifiers`)
console.log('Search counts per provider:', stats.identifiers)
// Example output:
// {
//   "AAPL": {
//     "eodhd": { "count": 5, "lastSearch": "2024-01-15T10:30:00.000Z" },
//     "alphaVantage": { "count": 2, "lastSearch": "2024-01-15T09:15:00.000Z" }
//   }
// }
```

### Historical Data Retrieval

```typescript
import { factory as eodhdFactory } from './eodhd'
import { factory as alphaVantageFactory } from './alpha-vantage'

const eodhd = eodhdFactory()
const alphaVantage = alphaVantageFactory()

// Get historical data for a date range
const history = await eodhd.getSecurityHistoryForDateRange('AAPL', startDate, endDate)

// Get historical data for a specific date
const dailyData = await alphaVantage.getSecurityHistoryForDate('AAPL', date)

// Get intraday data for a specific date (15-minute intervals by default)
const intradayData = await alphaVantage.getIntradaySecurityHistoryForDate('AAPL', date)

// Get intraday data with custom interval
const thirtyMinData = await alphaVantage.getIntradaySecurityHistoryForDate('AAPL', date, { interval: '30min' })
const hourlyData = await alphaVantage.getIntradaySecurityHistoryForDate('AAPL', date, { interval: '60min' })
```

## Response Formats

### Security Search Results

All providers return normalized `SecuritySearchResult` objects:

```typescript
{
  symbol: string,
  name: string,
  exchange?: string,
  country?: string,
  currency?: string,
  type?: string,
  isin?: string,
  cusip?: string,
  figi?: string,
  fromCache: boolean
}
```

### Historical Data Results

Historical data functions return `SecurityHistory` objects:

```typescript
{
  symbol: string,
  date: Date,
  open: number,
  high: number,
  low: number,
  close: number
}
```

**Note**: 
- Intraday data defaults to 15-minute intervals if no interval is specified
- Available intervals: `'15min'`, `'30min'`, `'60min'`
- Alpha Vantage uses "compact" output size for efficiency and trims data to the requested day
- Alpha Vantage timestamps are converted from US/Eastern timezone to UTC for consistency
- EODHD timestamps are provided in UTC

**📋 Important**: See [Interval Decision Documentation](docs/interval-decision.md) for detailed explanation of why we use 15-minute minimum intervals and "compact" output size.

## Documentation

For detailed design decisions and architectural documentation, see the [docs/](docs/) directory:

- [Interval Decision Documentation](docs/interval-decision.md) - Explains the 15-minute minimum interval decision
- [Documentation Index](docs/README.md) - Overview of all available documentation

## Testing

Run tests for individual providers:

```bash
# EODHD tests
npm run test:run server/services/securities/eodhd/search.test.ts
npm run test:run server/services/securities/eodhd/history.test.ts

# Alpha Vantage tests  
npm run test:run server/services/securities/alpha-vantage/search.test.ts
npm run test:run server/services/securities/alpha-vantage/history.test.ts

# All securities tests
npm run test:run server/services/securities/
```

## Code Quality

The service follows these principles:

- **DRY (Don't Repeat Yourself)**: Shared utilities eliminate code duplication
- **Single Responsibility**: Each module has a focused purpose
- **Type Safety**: Strong TypeScript typing throughout
- **Error Resilience**: Comprehensive error handling and recovery
- **Testability**: Isolated, testable functions with clear contracts

## Resolvers

The service provides a unified interface for securities resolution across multiple data sources, ensuring high availability and comprehensive coverage of global financial markets.



