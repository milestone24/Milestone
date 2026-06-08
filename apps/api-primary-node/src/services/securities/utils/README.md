# Securities Utilities

This directory contains utilities specific to the securities service, providing shared functionality for API integrations and data processing.

## Utility Functions

### Data Mapping Utilities

#### `security-history-mapper.ts`
Utilities for mapping API responses to standardized `SecurityHistory` format.

```typescript
import { 
  mapEodhdToSecurityHistory, 
  mapAlphaVantageToSecurityHistory,
  EODHDHistoryResponse,
  AlphaVantageHistoryValues
} from './security-history-mapper'

// Map EODHD response to SecurityHistory
const securityHistory = mapEodhdToSecurityHistory(eodhdResponse, symbol)

// Map Alpha Vantage response to SecurityHistory
const securityHistory = mapAlphaVantageToSecurityHistory(alphaVantageValues, date, symbol)
```

**Types:**
- `EODHDHistoryResponse` - EODHD API response structure
- `AlphaVantageHistoryValues` - Alpha Vantage time series values structure

### URL Construction Utilities

#### `provider-url-builders.ts`
Utilities for constructing provider-specific API URLs.

```typescript
import { 
  buildEodhdSearchUrl, 
  buildEodhdEodUrl, 
  buildAlphaVantageUrl 
} from './provider-url-builders'

// Build EODHD search URL
const searchUrl = buildEodhdSearchUrl('AAPL,GOOGL', apiKey)

// Build EODHD EOD URL
const eodUrl = buildEodhdEodUrl('AAPL', apiKey, '2024-01-01', '2024-01-31')

// Build Alpha Vantage URL
const alphaVantageUrl = buildAlphaVantageUrl({
  function: 'SYMBOL_SEARCH',
  keywords: 'AAPL',
  apikey: apiKey
})
```

### Response Validation Utilities

#### `provider-response-validation.ts`
Utilities for validating provider-specific API responses.

```typescript
import { 
  validateAlphaVantageResponse, 
  validateEodhdResponse, 
  validateAlphaVantageTimeSeries 
} from './provider-response-validation'

// Validate Alpha Vantage response
validateAlphaVantageResponse(data)

// Validate EODHD response
validateEodhdResponse(data)

// Validate Alpha Vantage time series data
const timeSeries = validateAlphaVantageTimeSeries(data, 'Context')
```

## Usage Guidelines

### When to Use These Utilities

1. **Data Mapping**: Use `security-history-mapper.ts` when converting API responses to `SecurityHistory` format
2. **URL Construction**: Use `provider-url-builders.ts` for building API URLs with proper formatting
3. **Response Validation**: Use `provider-response-validation.ts` for validating provider-specific API responses

### Integration with General Utilities

These securities-specific utilities work in conjunction with general utilities:

```typescript
import { validateApiKey } from '../../../utils/api-key-validation'
import { makeApiRequest } from '../../../utils/http-client'
import { buildEodhdSearchUrl } from '../utils/provider-url-builders'
import { validateEodhdResponse } from '../utils/provider-response-validation'

// Complete API call flow
const apiKey = validateApiKey('EODHD_API_KEY', 'EODHD')
const url = buildEodhdSearchUrl(symbols, apiKey)
const data = await makeApiRequest(url, 'EODHD')
validateEodhdResponse(data)
```

### Error Handling

All utilities are designed to work with the error handling utilities:

```typescript
import { withErrorHandling } from '../../../utils/error-handling'
import { mapEodhdToSecurityHistory } from './security-history-mapper'

const result = await withErrorHandling(
  async () => {
    // API call logic
    return mapEodhdToSecurityHistory(response, symbol)
  },
  'mapping EODHD response',
  []
)
```

## Type Safety

All utilities are fully typed with TypeScript:

- **Input Validation**: Utilities validate input parameters and provide clear error messages
- **Return Types**: All functions have explicit return types
- **Generic Support**: Where appropriate, utilities use generics for flexibility

## Testing

Utilities can be tested individually or as part of the securities service:

```bash
# Test specific utility
npm run test:run server/services/securities/utils/security-history-mapper.test.ts

# Test all securities utilities
npm run test:run server/services/securities/utils/
```

## Best Practices

1. **Consistency**: Use these utilities to maintain consistent patterns across all securities providers
2. **Error Handling**: Always validate responses before mapping data
3. **Type Safety**: Leverage TypeScript types for better development experience
4. **Testing**: Write unit tests for all utility functions
5. **Documentation**: Keep this README updated when adding new utilities

## Contributing

When adding new utilities:

1. Follow the existing patterns and naming conventions
2. Add comprehensive JSDoc comments
3. Include TypeScript types for all functions
4. Write unit tests for new utilities
5. Update this README with usage examples
6. Ensure utilities are specific to securities functionality
7. Consider whether functionality should be general-purpose or securities-specific 