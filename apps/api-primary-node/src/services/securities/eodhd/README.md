


# EODHD Securities Service

This service provides securities search and historical data functionality using the EODHD API.

## Features

- **Symbol Search**: Search for securities by symbol, company name, or keywords
- **Historical Data**: Retrieve daily price history for securities
- **Error Handling**: Graceful handling of API errors, authentication failures, and network issues
- **Type Safety**: Full TypeScript support with proper type definitions
- **Data Validation**: Filters out invalid securities from API responses
- **Utility Integration**: Uses shared utilities for consistent error handling and data validation

## Configuration

Set the following environment variable:

```bash
EODHD_API_KEY=your_api_key_here
```

You can obtain an API key from [EODHD](https://eodhd.com/).

## API Endpoints Used

- **Search**: Searches for securities by symbols or keywords
  - Returns array of securities with code, name, exchange, country, currency, type, and ISIN information
- **EOD**: Retrieves end-of-day historical price data
  - Returns OHLCV data for specified date ranges
- **Intraday**: Retrieves intraday historical price data (1-minute intervals)
  - Returns OHLCV data for specific dates with minute-level granularity

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

// Get intraday data for a specific date (1-minute intervals)
const intradayData = await getIntradaySecurityHistoryForDate('AAPL', date)
```

### Service Factory

```typescript
import { factory } from './index'

const eodhd = factory()

// Check capabilities
if (eodhd.canFindSecurities) {
  const results = await eodhd.findSecurities(['AAPL'])
}

if (eodhd.canGetSecurityHistoryForDateRange) {
  const history = await eodhd.getSecurityHistoryForDateRange('AAPL', startDate, endDate)
}

if (eodhd.canGetIntradaySecurityHistoryForDate) {
  const intradayData = await eodhd.getIntradaySecurityHistoryForDate('AAPL', date)
}
```

## Response Formats

### Security Search Results

Returns an array of `EODHDSecurity` objects with the following structure:

```typescript
{
  Code: string,
  Country: string,
  Currency: string,
  Exchange: string,
  ISIN: string,
  Name: string,
  Type: string,
  previousClose: number,
  previousCloseDate: string
}
```

These are then normalized to `SecuritySearchResult` objects in the factory.

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
- **API Error Responses**: Handles error objects with `error` or `message` fields
- **Network Errors**: Catches and logs fetch exceptions
- **Invalid Data**: Filters out malformed security objects
- **Empty Responses**: Handles empty arrays gracefully
- **Invalid Dates**: Date validation with clear error messages

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
- **`response-validation.ts`** - Response validation utilities

### Securities-Specific Utilities (`server/services/securities/utils/`)
- **`provider-url-builders.ts`** - EODHD URL construction
- **`provider-response-validation.ts`** - EODHD response validation
- **`security-history-mapper.ts`** - Data mapping to SecurityHistory format

## Testing

Run the tests with:

```bash
# Search functionality tests
npm run test:run server/services/securities/eodhd/search.test.ts

# Historical data tests
npm run test:run server/services/securities/eodhd/history.test.ts

# All EODHD tests
npm run test:run server/services/securities/eodhd/
```

## Code Quality

The service follows these principles:
- **DRY**: Uses shared utilities to eliminate code duplication
- **Single Responsibility**: Each module has a focused purpose
- **Type Safety**: Strong TypeScript typing throughout
- **Error Resilience**: Comprehensive error handling and recovery
- **Testability**: Isolated, testable functions with clear contracts

## Useful Links

- [EODHD API Documentation](https://eodhd.com/financial-apis/category/excel-python-php-laravel-java-matlab-examples)
- [EODHD Website](https://eodhd.com/)