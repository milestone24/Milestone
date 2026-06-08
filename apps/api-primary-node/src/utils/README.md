# Server Utilities

This directory contains general-purpose utility functions used throughout the server application.

## Utility Functions

### API Integration Utilities

#### `api-key-validation.ts`
Utilities for validating API keys from environment variables.

```typescript
import { validateApiKey, validateApiKeyOptional } from './api-key-validation'

// Required API key validation (throws error if missing)
const apiKey = validateApiKey('API_KEY_NAME', 'Provider Name')

// Optional API key validation (returns null if missing)
const apiKey = validateApiKeyOptional('API_KEY_NAME', 'Provider Name')
```

#### `http-client.ts`
Standardized HTTP request handling with consistent error handling.

```typescript
import { makeApiRequest, makeApiRequestWithHeaders } from './http-client'

// Basic API request
const data = await makeApiRequest(url, 'Provider Name')

// API request with custom headers
const data = await makeApiRequestWithHeaders(url, 'Provider Name', headers)
```

#### `response-validation.ts`
Utilities for validating API response data.

```typescript
import { validateArrayResponse, validateObjectResponse, validateRequiredField } from './response-validation'

// Validate array response
const arrayData = validateArrayResponse(data, 'Context')

// Validate object response
const objectData = validateObjectResponse(data, 'Context')

// Validate required field exists
const isValid = validateRequiredField(obj, 'fieldName', 'Context')
```

### Date and Time Utilities

#### `date-validation.ts`
Utilities for validating and formatting dates.

```typescript
import { validateAndExtractDateString, validateAndExtractDateRange } from './date-validation'

// Extract date string from Date object
const dateStr = validateAndExtractDateString(date)

// Extract date range strings
const { startDateStr, endDateStr } = validateAndExtractDateRange(startDate, endDate)
```

#### `time.ts`
Time-related utilities for parsing and formatting time values.

```typescript
import { parseTimeValue, timeToExpiryDate, validateAuthEnvVars } from './time'

// Parse time value string
const milliseconds = parseTimeValue('30d')

// Convert time to expiry date
const expiryDate = timeToExpiryDate('15m')

// Validate authentication environment variables
validateAuthEnvVars()
```

### Error Handling Utilities

#### `error-handling.ts`
Consistent error handling patterns for async and sync operations.

```typescript
import { withErrorHandling, withErrorHandlingSync } from './error-handling'

// Async operation with error handling
const result = await withErrorHandling(
  async () => { /* operation */ },
  'operation context',
  fallbackValue
)

// Sync operation with error handling
const result = withErrorHandlingSync(
  () => { /* operation */ },
  'operation context',
  fallbackValue
)
```

### Data Processing Utilities

#### `securities.ts`
Securities-specific data processing utilities.

```typescript
import { combineSecurityResults } from './securities'

// Combine and deduplicate security results
const combinedResults = combineSecurityResults(cached, external)
```

#### `resource-query-builder.ts`
Utilities for building database queries and resource operations.

```typescript
import { ResourceQueryBuilder } from './resource-query-builder'

// Build complex database queries
const query = new ResourceQueryBuilder()
  .select(['id', 'name'])
  .where('status', 'active')
  .orderBy('created_at', 'desc')
```

#### `uuid.ts`
UUID generation and validation utilities.

```typescript
import { generateUUID, isValidUUID } from './uuid'

// Generate new UUID
const id = generateUUID()

// Validate UUID format
const isValid = isValidUUID(id)
```

## Usage Guidelines

### When to Use These Utilities

1. **API Integration**: Use `api-key-validation.ts`, `http-client.ts`, and `response-validation.ts` for external API calls
2. **Date Handling**: Use `date-validation.ts` for date formatting and validation
3. **Error Handling**: Use `error-handling.ts` for consistent error handling patterns
4. **Time Operations**: Use `time.ts` for time parsing and authentication timeouts
5. **Data Processing**: Use `securities.ts` for securities-specific operations
6. **Database Queries**: Use `resource-query-builder.ts` for complex database operations
7. **ID Generation**: Use `uuid.ts` for UUID generation and validation

### Best Practices

1. **Consistency**: Use these utilities to maintain consistent patterns across the application
2. **Error Handling**: Always use appropriate error handling utilities for external operations
3. **Type Safety**: These utilities are fully typed - leverage TypeScript for better development experience
4. **Testing**: All utilities are designed to be easily testable and mockable
5. **Documentation**: Keep this README updated when adding new utilities

### Testing

Utilities can be tested individually:

```bash
# Test specific utility
npm run test:run server/utils/api-key-validation.test.ts

# Test all utilities
npm run test:run server/utils/
```

## Contributing

When adding new utilities:

1. Follow the existing patterns and naming conventions
2. Add comprehensive JSDoc comments
3. Include TypeScript types for all functions
4. Write unit tests for new utilities
5. Update this README with usage examples
6. Consider whether the utility should be general-purpose or service-specific 