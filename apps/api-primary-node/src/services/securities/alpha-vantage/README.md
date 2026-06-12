# Alpha Vantage Securities Service

This service provides securities search and historical data functionality using the Alpha Vantage API.

## Features

- **Symbol Search**: Search for securities by symbol, company name, or keywords
- **Historical Data**: Retrieve daily price history for securities
- **Error Handling**: Graceful handling of API errors, rate limiting, and network issues
- **Type Safety**: Full TypeScript support with proper type definitions
- **Utility Integration**: Uses shared utilities for consistent error handling and data validation

## Configuration

Set the following environment variable:

```bash
ALPHA_VANTAGE_API_KEY=your_api_key_here
```

You can obtain a free API key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key).

## API Endpoints Used

- **SYMBOL_SEARCH**: Searches for securities by keywords
  - Returns best matches with symbol, name, type, region, and currency information
- **TIME_SERIES_DAILY**: Retrieves daily historical price data
  - Returns OHLCV data for specified date ranges
- **TIME_SERIES_INTRADAY**: Retrieves intraday price data (15-minute, 30-minute, or 60-minute intervals)
  - Returns OHLCV data for specific dates with configurable granularity
  - Uses "compact" output size for efficiency
  - **Note**: See [Interval Decision Documentation](../docs/interval-decision.md) for detailed explanation of interval choices

## Rate Limits

Alpha Vantage has the following rate limits:
- 5 API calls per minute (free tier)
- 500 API calls per day (free tier)

The service handles rate limiting gracefully by logging warnings and continuing with other operations.

## Usage

### Security Search

```typescript
import { findSecurities } from './search'

const results = await findSecurities(['AAPL', 'GOOGL'])
```

### Historical Data

```typescript
import { getSecurityHistoryForDateRange, getSecurityHistoryForDate } from './history'

// Get historical data for a date range
const history = await getSecurityHistoryForDateRange('AAPL', startDate, endDate)

// Get historical data for a specific date
const dailyData = await getSecurityHistoryForDate('AAPL', date)

// Get intraday data for a specific date (15-minute intervals by default)
const intradayData = await getIntradaySecurityHistoryForDate('AAPL', date)

// Get intraday data with custom interval
const thirtyMinData = await getIntradaySecurityHistoryForDate('AAPL', date, { interval: '30min' })
const hourlyData = await getIntradaySecurityHistoryForDate('AAPL', date, { interval: '60min' })
```

### Service Factory

```typescript
import { factory } from './index'

const alphaVantage = factory()

// Check capabilities
if (alphaVantage.canFindSecurities) {
  const results = await alphaVantage.findSecurities(['AAPL'])
}

if (alphaVantage.canGetSecurityHistoryForDateRange) {
  const history = await alphaVantage.getSecurityHistoryForDateRange('AAPL', startDate, endDate)
}

if (alphaVantage.canGetIntradaySecurityHistoryForDate) {
  const intradayData = await alphaVantage.getIntradaySecurityHistoryForDate('AAPL', date)
}
```

## Response Formats

### Security Search Results

Returns an array of `SecuritySearchResult` objects with the following structure:

```typescript
{
  symbol: string,
  name: string,
  type: string,
  country: string,
  currency: string,
  exchange: undefined, // Not provided by Alpha Vantage search
  isin: undefined,
  cusip: undefined,
  figi: undefined,
  fromCache: false
}
```

### Historical Data Results

Returns `SecurityHistory` objects with the following structure:

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

## Error Handling

The service implements comprehensive error handling using shared utilities:

### Error Scenarios Handled:
- **Missing API Key**: Returns empty array for search, throws error for history
- **HTTP Errors**: 401, 403, 429, 500+ status codes
- **API Errors**: Invalid API calls, authentication failures
- **Rate Limiting**: API quota exceeded warnings
- **Network Errors**: Connection timeouts, DNS failures
- **Invalid Dates**: Date validation with clear error messages
- **Invalid Data**: Malformed responses filtered out

### Error Recovery:
- Graceful degradation when API is unavailable
- Detailed logging for debugging and monitoring
- Consistent error handling patterns across all functions

## Utility Integration

The service leverages the following utilities:

### General-Purpose Utilities (`server/utils/`)
- **`api-key-validation.ts`** - API key validation
- **`http-client.ts`** - Standardized HTTP requests
- **`error-handling.ts`** - Consistent error handling
- **`date-validation.ts`** - Date validation and formatting

### Securities-Specific Utilities (`server/services/securities/utils/`)
- **`provider-url-builders.ts`** - Alpha Vantage URL construction
- **`provider-response-validation.ts`** - Alpha Vantage response validation
- **`security-history-mapper.ts`** - Data mapping to SecurityHistory format

## Testing

Run the tests with:

```bash
# Search functionality tests
npm run test:run server/services/securities/alpha-vantage/search.test.ts

# Historical data tests
npm run test:run server/services/securities/alpha-vantage/history.test.ts

# All Alpha Vantage tests
npm run test:run server/services/securities/alpha-vantage/
```

## Code Quality

The service follows these principles:
- **DRY**: Uses shared utilities to eliminate code duplication
- **Single Responsibility**: Each module has a focused purpose
- **Type Safety**: Strong TypeScript typing throughout
- **Error Resilience**: Comprehensive error handling and recovery
- **Testability**: Isolated, testable functions with clear contracts 