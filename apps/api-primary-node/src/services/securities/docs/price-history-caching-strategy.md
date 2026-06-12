# Daily Price History Caching Strategy

## Overview

This document outlines the design and implementation strategy for caching daily price history data in the Securities Service. The goal is to reduce API load by storing historical OHLCV (Open, High, Low, Close, Volume) data in PostgreSQL, eliminating redundant API calls for data that never changes.

## Problem Statement

Currently, the Securities Service fetches all historical price data directly from external APIs (EODHD and Alpha Vantage) on every request. This creates significant inefficiencies in the broader asset management system:

### Current Asset Value System
- **AssetValues Table**: Records historical total values for user investment accounts (`brokerProviderAssets`)
- **Manual Entry**: Users currently add intermittent manual records of asset performance
- **Limited Automation**: No systematic way to calculate asset values from live security data

### API Efficiency Problem
- **Shared Securities**: Multiple users holding the same securities (AAPL, GOOGL, etc.)
- **Redundant API Calls**: Fetching identical price history for the same security across different users
- **API Quota Waste**: Same historical data requested repeatedly for portfolio calculations
- **Scaling Issues**: API usage grows linearly with user count, even for identical securities

### Transition to Automated Asset Values
The system will evolve to automatically calculate `AssetValues` using live security data:
```
AssetValue = Σ(security_price × shareHolding) for each security in the asset
```

**Key Insight**: Historical daily price data is immutable and highly reusable across users. Caching this data once enables automated asset value calculations for all users holding the same securities.

## Design Decisions

### Database-First Approach

**Decision**: Implement caching using PostgreSQL as the primary storage layer.

**Rationale**:
- Leverages existing database infrastructure
- Provides ACID compliance and data durability
- Enables complex queries and analytics
- Integrates seamlessly with existing Drizzle ORM patterns
- Future Redis integration can be added as a performance layer

### Simplified Schema Design

**Key Architectural Decision**: Single `entryMethod` enum instead of dual tracking.

**Rejected Approach**: Separate `valueCalculationMode` on assets + `calculationMethod` on values
**Chosen Approach**: Single `entryMethod` enum on asset values only

**Benefits**:
- **No Redundant Data**: Asset mode derived from entry patterns, not stored separately
- **Simpler Logic**: No need to maintain consistency between asset flags and value entries
- **Flexible Transitions**: Assets can seamlessly switch between manual and automated modes
- **Single Source of Truth**: Entry method is tracked where the data actually lives

### Comprehensive Metadata Strategy

**Decision**: Rich JSON metadata with full type safety for transparency and debugging.

**Rationale**:
- **Audit Trail**: Complete record of how values were calculated
- **Debugging Support**: Detailed error tracking and data source information
- **User Transparency**: Clear breakdown of security contributions
- **Data Quality**: Track data completeness and estimation methods
- **Future-Proof**: Flexible structure for additional metadata needs

### Cache-First Strategy

**Decision**: Implement a cache-first approach with API fallback for missing data.

**Flow**:
1. Check database cache for requested date range
2. Identify missing dates within the range
3. Fetch only missing data from APIs
4. Store fetched data in cache
5. Return combined cached and fresh data

### Asset Value Integration

**Dual-Mode System**: Preserve existing manual entry while adding automated calculations.

**Key Principles**:
- **No Removal**: All existing manual asset value logic remains untouched
- **Entry-Level Tracking**: Each `assetValue` entry tracks its creation method via `entryMethod` enum
- **No Asset-Level Flags**: Asset mode determined dynamically by examining entry patterns
- **Incremental Updates**: Only add new calculated values, never modify historical ones
- **Flexible Transition**: Assets can transition between manual and automated modes seamlessly

### Data Timing & Availability

**End-of-Day Focus**: Use only end-of-day prices (midnight UTC records)
- **Rationale**: Intraday data handled separately; API providers unlikely to have weekend data
- **Consistency**: Aligns with daily asset value calculation needs

### Scope Limitations

**Current Scope**: Daily price data only (midnight UTC records)
**Future Scope**: Intraday data will be addressed in a separate implementation phase

## Database Schema Design

### New Table: `security_daily_history`

```typescript
export const securityDailyHistory = pgTable("security_daily_history", {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  securityId: uuid("security_id").notNull().references(() => securities.id),
  date: date("date").notNull(), // DATE type for efficient date queries
  open: decimal("open", { precision: 10, scale: 4 }),
  high: decimal("high", { precision: 10, scale: 4 }),
  low: decimal("low", { precision: 10, scale: 4 }),
  close: decimal("close", { precision: 10, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  source: text("source").notNull(), // 'eodhd' or 'alphavantage'
  ...timestampColumns()
});
```

### Schema Rationale

**Data Types**:
- `date`: PostgreSQL DATE type for efficient date range queries and storage
- `decimal(10,4)`: Provides sufficient precision for most securities (up to $999,999.9999)
- `bigint`: Handles large volume numbers without overflow
- `uuid`: Consistent with existing schema patterns

**Constraints**:
- Foreign key to `securities.id` ensures referential integrity
- Composite unique constraint on `(security_id, date)` prevents duplicate entries
- NOT NULL constraints on essential fields

**Source Tracking**:
- Records which API provided the data for auditing and debugging
- Enables data quality analysis and provider comparison

### Enhanced AssetValues Schema

**Proposed Updates** to support dual-mode operation:

```typescript
// New enum for entry method
export const entryMethod = ['manual', 'calculated'] as const;
export const entryMethodEnum = pgEnum('entry_method', entryMethod);
export type EntryMethod = (typeof entryMethod)[number];

export const assetValues = pgTable("asset_values", {
  id: uuid('id').notNull().default(sql`gen_random_uuid()`),
  value: real("value").notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  assetId: uuid("asset_id").notNull(),
  entryMethod: entryMethodEnum("entry_method").notNull().default("manual"),
  metadata: jsonb("metadata"), // Detailed entry information and calculation breakdown
  ...timestampColumns()
});
```

**Design Simplification**: 
- **Single Point of Truth**: No separate `valueCalculationMode` on assets
- **Implicit Asset Mode**: Determined by examining `entryMethod` values in `assetValues`
- **Dynamic Detection**: Query asset values to determine if automated or manual

### Metadata Structure & Type Safety

**TypeScript Interfaces**:

```typescript
// Base metadata interface
interface AssetValueMetadataBase {
  entryMethod: 'manual' | 'calculated';
  notes?: string;
  dataSource?: string;
  calculatedAt?: string; // ISO timestamp
}

// Manual entry metadata
interface ManualEntryMetadata extends AssetValueMetadataBase {
  entryMethod: 'manual';
  userNotes?: string;
  externalSource?: string; // e.g., "broker statement", "manual calculation"
  confidence?: 'high' | 'medium' | 'low';
}

// Calculated entry metadata
interface CalculatedEntryMetadata extends AssetValueMetadataBase {
  entryMethod: 'calculated';
  calculation: {
    totalValue: number;
    securities: SecurityContribution[];
    priceDate: string; // ISO date string (YYYY-MM-DD)
    calculationTimestamp: string;
    dataQuality: 'complete' | 'partial' | 'estimated';
  };
  sources: {
    primary: 'eodhd' | 'alphavantage';
    fallbacks?: ('eodhd' | 'alphavantage')[];
  };
  errors?: CalculationError[];
}

interface SecurityContribution {
  securityId: string;
  symbol: string;
  name: string;
  shareHolding: number;
  pricePerShare: number;
  contribution: number; // shareHolding * pricePerShare
  priceSource: 'eodhd' | 'alphavantage' | 'estimated';
  priceAge?: number; // Days old if not current
}

interface CalculationError {
  type: 'missing_price' | 'api_error' | 'data_quality';
  securityId?: string;
  symbol?: string;
  message: string;
  resolution?: 'used_previous_price' | 'excluded_security' | 'estimated';
}

// Union type for all metadata
type AssetValueMetadata = ManualEntryMetadata | CalculatedEntryMetadata;
```

**Example Calculated Entry Metadata**:
```json
{
  "entryMethod": "calculated",
  "calculatedAt": "2024-01-15T10:30:00.000Z",
  "calculation": {
    "totalValue": 15234.67,
    "securities": [
      {
        "securityId": "uuid-1",
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "shareHolding": 10.5,
        "pricePerShare": 150.25,
        "contribution": 1577.625,
        "priceSource": "eodhd"
      }
    ],
    "priceDate": "2024-01-15",
    "calculationTimestamp": "2024-01-15T10:30:00.000Z",
    "dataQuality": "complete"
  },
  "sources": {
    "primary": "eodhd"
  }
}
```

**Example Manual Entry Metadata**:
```json
{
  "entryMethod": "manual",
  "userNotes": "Updated from broker statement",
  "externalSource": "Trading212 statement",
  "confidence": "high",
  "calculatedAt": "2024-01-15T14:30:00.000Z"
}
```

## Performance Considerations

### Indexing Strategy

```sql
-- Primary index for date range queries (most common use case)
CREATE INDEX idx_security_daily_history_lookup 
ON security_daily_history(security_id, date);

-- Source-based index for debugging and analytics
CREATE INDEX idx_security_daily_history_source 
ON security_daily_history(source);

-- Date-only index for bulk operations
CREATE INDEX idx_security_daily_history_date 
ON security_daily_history(date);
```

### Query Optimization

- Use `BETWEEN` clauses for efficient date range queries
- Leverage PostgreSQL's native date functions
- Implement batch inserts for multiple records
- Consider table partitioning for very large datasets (future optimization)

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **Database Migration**: Create `security_daily_history` table with indexes
2. **Schema Integration**: Add new table to Drizzle schema exports  
3. **Enhanced AssetValues**: Add `entryMethod` enum and `metadata` JSONB column
4. **Basic Cache Functions**: Implement core CRUD operations in `cache/` directory
5. **API Integration**: Update existing history functions to use cache-first approach

### Phase 2: Asset Value Automation
6. **Real-Time Calculation**: Implement triggered calculations on securities changes
7. **Metadata Management**: Add type-safe metadata creation and validation
8. **Historical Backfill**: Background process for calculating missing asset values
9. **Asset Mode Detection**: Functions to determine manual vs automated assets

### Phase 3: Enhanced Functionality  
10. **Bulk Operations**: Implement efficient batch insert/update operations
11. **Missing Date Detection**: Add logic to identify gaps in cached data
12. **Error Handling**: Robust error handling for cache and calculation failures
13. **Monitoring**: Add logging and metrics for cache and calculation performance

### Phase 4: Optimization & Management
14. **Cache Warming**: Implement background jobs for popular securities
15. **Data Quality**: Add validation and consistency checks
16. **Management APIs**: Create endpoints for cache administration
17. **Documentation**: Update API documentation and usage examples

## User Workflow Integration

### New Asset Creation Flow

**User Action**: Creates new `brokerProviderAsset` and adds securities with `shareHolding` values

**System Response**:
1. **Immediate Calculation**: Calculate current asset value using cached prices
2. **Cache Population**: Fetch missing price data from APIs if needed
3. **Historical Backfill**: Queue background job to calculate historical values
4. **User Feedback**: Show current value immediately, indicate historical data loading

**Implementation Considerations**:
- **Synchronous UI Update**: Provide immediate feedback for current value
- **Asynchronous Backfill**: Historical calculations happen in background
- **Progressive Enhancement**: Show partial data while calculations complete
- **Error Gracefully**: Handle missing price data without blocking user flow

### Securities Modification Flow

**User Action**: Adds/removes securities or modifies `shareHolding` amounts

**System Response**:
1. **Recalculate Current**: Update current asset value immediately
2. **Invalidate Historical**: Mark future recalculation needed for modified periods
3. **Background Update**: Recalculate affected historical values
4. **Audit Trail**: Maintain metadata showing calculation changes

**Data Consistency Considerations**:
- **Temporal Accuracy**: Ensure holdings changes only affect values from change date forward
- **Calculation Transparency**: Metadata shows which securities contributed to each value
- **Performance**: Minimize recalculation scope to affected date ranges only

## Integration Points

### Modified Functions

**`getSecurityHistoryForDateRange()`**:
- Check cache for existing data in date range
- Identify missing dates
- Fetch missing data from APIs
- Cache new data
- Return combined results

**`getSecurityHistoryForDate()`**:
- Single-date cache lookup
- API fallback if not cached
- Cache the result

**`getCalculatedSecurityHistoryForDateRange()`**:
- Leverage cached data for holdings calculations
- Maintain existing calculation logic

### Asset Value Calculation Functions

**New functions for automated asset value calculation**:

```typescript
export async function calculateAssetValueForDate(
  assetId: string,
  date: Date
): Promise<{
  value: number;
  metadata: CalculatedEntryMetadata;
} | null>

export async function syncAssetValuesFromStartDate(
  assetId: string,
  startDate: Date
): Promise<void>

export async function bulkSyncAllAutomatedAssets(): Promise<void>

// Asset mode detection utilities
export async function getAssetCalculationMode(
  assetId: string
): Promise<'manual' | 'automated' | 'mixed'>

export async function hasCalculatedEntries(
  assetId: string
): Promise<boolean>
```

### Metadata Management Functions

**Type-safe metadata handling**:

```typescript
// Type guards for metadata
export function isCalculatedMetadata(
  metadata: AssetValueMetadata
): metadata is CalculatedEntryMetadata

export function isManualMetadata(
  metadata: AssetValueMetadata
): metadata is ManualEntryMetadata

// Metadata creation utilities
export function createCalculatedMetadata(
  securities: SecurityContribution[],
  sources: CalculatedEntryMetadata['sources'],
  errors?: CalculationError[]
): CalculatedEntryMetadata

export function createManualMetadata(
  userNotes?: string,
  externalSource?: string,
  confidence?: 'high' | 'medium' | 'low'
): ManualEntryMetadata
```

### Real-Time Calculation Triggers

**Event-driven asset value calculation**:

```typescript
// Triggered when user adds/modifies securities
export async function onSecuritiesUpdated(
  assetId: string,
  securitiesData: Array<{
    securityId: string;
    shareHolding: number;
    recordedAt: Date;
  }>
): Promise<{
  currentValue: number;
  metadata: CalculatedEntryMetadata;
  historicalBackfillNeeded: boolean;
}>

// Background historical backfill
export async function backfillAssetHistoricalValues(
  assetId: string,
  fromDate: Date,
  toDate?: Date
): Promise<{
  valuesCreated: number;
  missingDates: Date[];
  errors: CalculationError[];
}>

// Real-time calculation for immediate UI feedback
export async function calculateCurrentAssetValue(
  assetId: string,
  date?: Date // Defaults to today
): Promise<{
  value: number;
  metadata: CalculatedEntryMetadata;
  cached: boolean; // Whether calculation used cached prices
}>
```

### Cache Functions

**New functions in `cache/index.ts`**:
```typescript
export async function getCachedDailyHistory(
  securityId: string, 
  startDate: Date, 
  endDate: Date
): Promise<SecurityDailyHistory[]>

export async function cacheDailyHistory(
  securityId: string,
  historyData: SecurityHistory[]
): Promise<void>

export async function findMissingDates(
  securityId: string,
  startDate: Date, 
  endDate: Date
): Promise<Date[]>
```

## Future Considerations

### Redis Integration (Phase 4)

**Hybrid Approach**:
- **Hot Data**: Recent 30-90 days in Redis for fastest access
- **Cold Data**: Older historical data in PostgreSQL
- **Cache Hierarchy**: Redis → PostgreSQL → API

### Intraday Data Extension

**Separate Implementation**:
- Different TTL requirements
- Market hours considerations
- Higher storage volume
- Potential for separate table or partitioning strategy

### Data Management

**Potential Enhancements**:
- Data quality monitoring and alerts
- Automated data validation
- Provider comparison and fallback logic
- Cache warming based on user portfolio analysis

## Success Metrics

**Performance Improvements**:
- Reduced API call volume
- Faster response times for cached data
- Improved system reliability

**Cost Benefits**:
- Lower API usage costs
- Reduced bandwidth consumption
- Decreased dependency on external services

## Risk Mitigation

**Data Consistency**:
- Comprehensive error handling
- API fallback for cache failures
- Data validation and integrity checks

**Migration Safety**:
- Incremental rollout approach
- Backward compatibility maintenance
- Rollback procedures

## Outstanding Discussion Points

The following items require further discussion and decision-making:

### **C. Missing Price Data Handling**
**Issue**: When some securities in an asset lack price data for a given date.

**Current Consideration**: Implement "NA" (not available) flag for missing data.
- **Approach**: Higher-level accumulative methods could presume value from previous available data
- **Decision Needed**: Specific fallback logic and NA value representation
- **Impact**: Affects asset value calculation accuracy and user transparency

### **D. Background Sync Optimization Patterns**
**Issue**: Optimal patterns for system-wide background synchronization.

**Current Approach**: Background job syncs entire system where possible.
- **Considerations**: 
  - Database load balancing
  - API rate limiting coordination
  - Error handling and retry strategies
  - Monitoring and alerting
- **Decision Needed**: Specific scheduling, batching, and error recovery patterns

### **E. Real-Time Asset Value Calculation Triggers**
**Issue**: When and how to trigger automated asset value calculations.

**Key Trigger Events**:
1. **New Asset Creation**: User creates new `brokerProviderAsset` with securities
2. **Securities Addition**: User adds new securities to existing asset with `shareHolding` values
3. **Holdings Update**: User modifies `shareHolding` amounts for existing securities
4. **Scheduled Sync**: Background job for periodic updates

**Real-Time Calculation Requirements**:
- **Immediate Feedback**: Calculate current asset value when securities are added/modified
- **Historical Backfill**: Calculate missing historical asset values from asset creation date
- **Cache Utilization**: Leverage existing price cache for instant calculations
- **API Fallback**: Fetch missing price data if not in cache

**Decision Points**:
- Should calculation happen synchronously during save operation or asynchronously?
- How far back should historical backfill go when new securities are added?
- Should we show partial asset values if some securities lack price data?
- How to handle calculation failures during user interactions?

### **Additional Technical Decisions**

**Asset Mode Configuration**:
- Where to store the manual/automated flag for each `brokerProviderAsset`
- UI/UX for mode switching
- Data migration strategy for existing assets

**Error Handling Strategy**:
- Partial calculation failures
- API timeout scenarios  
- Data quality validation rules

**Performance Optimization**:
- Batch processing strategies
- Database connection pooling for large sync operations
- Memory usage optimization for bulk calculations

## Related Documentation

- [Exchange Handling Documentation](exchange-handling.md) - Understanding exchange-specific requirements
- [Interval Decision Documentation](interval-decision.md) - Intraday data considerations for future phases
- [Main Securities README](../README.md) - Overall service architecture

---

**Document Status**: Draft - Under Discussion
**Last Updated**: [Current Date]
**Next Review**: After implementation completion