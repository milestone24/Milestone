# Securities Sync Module

This module handles the synchronization of security price history and automated calculation of asset values.

## Overview

The sync module is responsible for:
- **Security Daily History Caching**: Populating the `security_daily_history` table from external APIs
- **Asset Value Calculation**: Computing asset values from cached price data and security holdings
- **Real-Time Triggers**: Responding to user actions (adding/modifying securities)
- **Background Synchronization**: Bulk operations for system-wide updates

## Module Structure

```
sync/
├── index.ts           # Main module with all sync functions
├── sync.test.ts       # Comprehensive test suite
├── README.md          # This documentation
└── (future files)
    ├── cache-manager.ts    # Cache-specific operations
    ├── calculation-engine.ts # Asset value calculation logic
    └── background-jobs.ts   # Scheduled sync operations
```

## Core Functions

### Daily History Caching

#### `populateSecurityDailyHistory(securityId, startDate, endDate)`
Populates daily price history for a single security over a date range.

**Use Cases:**
- When a new security is added to an asset
- Manual cache warming for specific securities
- Backfilling missing historical data

**Returns:**
- Records added/skipped counts
- Missing dates that couldn't be populated
- API source usage statistics
- Detailed error information

#### `bulkPopulateSecurityDailyHistory(requests)`
Efficiently processes multiple securities in parallel.

**Use Cases:**
- Initial cache population for new securities
- Bulk cache warming operations
- Recovery from cache corruption

### Asset Value Calculation

#### `calculateAssetValueForDate(assetId, date)`
Calculates the total value of an asset for a specific date using cached price data.

**Use Cases:**
- Real-time asset value display
- Historical asset value reconstruction
- Portfolio performance analysis

**Returns:**
- Calculated asset value
- Comprehensive metadata including:
  - Security-by-security breakdown
  - Data quality indicators
  - Price sources used
  - Error details for missing data

#### `populateAssetValuesForDateRange(assetId, startDate, endDate)`
Creates `asset_values` records for a date range.

**Use Cases:**
- Historical backfill for newly automated assets
- Recalculation after security holdings changes
- Data migration scenarios

### Real-Time Integration

#### `onSecuritiesUpdated(assetId, securitiesData)`
Triggered when user adds or modifies securities in an asset.

**Workflow:**
1. Calculate current asset value immediately
2. Determine if historical backfill is needed
3. Queue background jobs for historical data
4. Return immediate feedback to UI

**Use Cases:**
- User adds securities to new asset
- User modifies share holdings
- User removes securities from asset

### Background Operations

#### `bulkSyncAllAutomatedAssets(options)`
System-wide synchronization for all automated assets.

**Use Cases:**
- Daily scheduled maintenance
- Recovery from system downtime
- Bulk data updates

**Features:**
- Configurable concurrency limits
- Dry run mode for testing
- Comprehensive performance metrics
- Error recovery and retry logic

## Implementation Status

| Function | Status | Notes |
|----------|--------|-------|
| `populateSecurityDailyHistory` | 🔴 Stub | Core caching logic needed |
| `bulkPopulateSecurityDailyHistory` | 🔴 Stub | Parallel processing implementation |
| `calculateAssetValueForDate` | 🔴 Stub | Calculation engine required |
| `populateAssetValuesForDateRange` | 🔴 Stub | Database integration needed |
| `onSecuritiesUpdated` | 🔴 Stub | Real-time trigger implementation |
| `bulkSyncAllAutomatedAssets` | 🔴 Stub | Background job framework |

## Next Steps

1. **Implement Cache Operations**: Start with `populateSecurityDailyHistory`
2. **Build Calculation Engine**: Implement `calculateAssetValueForDate`
3. **Add Database Integration**: Connect to `security_daily_history` and `asset_values` tables
4. **Implement Error Handling**: Comprehensive error tracking and recovery
5. **Add Performance Monitoring**: Cache hit rates, API usage tracking
6. **Background Job Integration**: Connect to job queue system

## Testing Strategy

The test suite covers:
- **Unit Tests**: Individual function behavior
- **Integration Tests**: End-to-end workflows
- **Error Scenarios**: API failures, missing data
- **Performance Tests**: Bulk operations, concurrency limits

Run tests:
```bash
npm run test:run server/services/securities/sync/sync.test.ts
```

## Dependencies

- **Database**: Access to `security_daily_history` and `asset_values` tables
- **Securities API**: Integration with EODHD and Alpha Vantage APIs
- **Cache Module**: Existing securities cache functions
- **Job Queue**: Background job processing (future)

## Related Documentation

- [Price History Caching Strategy](../docs/price-history-caching-strategy.md)
- [Securities Service README](../README.md)
- [Database Schema Documentation](../../../db/schema/)