# Historical Data Limitations

## Overview

This document outlines the limitations and constraints for retrieving historical security data from external API providers, including current known limitations, configuration options, and research requirements.

## Current Implementation

### Configurable Limitation
- **Maximum History Period**: 3 months (configurable via environment variable)
- **Environment Variable**: `SECURITIES_MAX_HISTORY_MONTHS=3`
- **Applies To**: All historical data retrieval operations across all providers

### Rationale for 3-Month Limit
- **Reliability**: Ensures consistent data availability across all API tiers
- **Performance**: Reduces API load and response times for large date ranges
- **Cost Management**: Minimizes API quota usage for free and lower-tier accounts
- **User Experience**: Provides immediate feedback without long wait times

## Known Provider Limitations

### EODHD
- **Status**: Historical data availability varies significantly by API tier and security type
- **Free Tier**: Limited historical data depth (exact limitations unknown)
- **Paid Tiers**: Extended historical data access (specifics require research)
- **Security Types**: Different limitations may apply to stocks, ETFs, bonds, etc.

### Alpha Vantage
- **Free Tier**: Restricted historical data depth (exact limitations unknown)
- **Premium Tiers**: Extended historical data access (specifics require research)
- **Rate Limits**: May affect large historical data requests
- **Output Size**: "Compact" vs "Full" output affects available data range

## Configuration

### Environment Variables
```bash
# Historical Data Configuration
SECURITIES_MAX_HISTORY_MONTHS=3    # Maximum months of history to fetch (default: 3)
```

### Implementation Behavior
- Date range requests beyond the configured limit are automatically truncated
- Truncation occurs at the service level before making API calls
- Warning logs are generated when truncation occurs
- No error is thrown - operation continues with truncated range

### Usage in Code
```typescript
// Example: User requests 1 year of data, but system limits to 3 months
const requestedStartDate = new Date('2023-01-01')
const endDate = new Date('2023-12-31')
const maxHistoryMonths = parseInt(process.env.SECURITIES_MAX_HISTORY_MONTHS || '3')

// System automatically truncates to last 3 months
const effectiveStartDate = new Date()
effectiveStartDate.setMonth(effectiveStartDate.getMonth() - maxHistoryMonths)
```

## Research Requirements (TODOs)

### EODHD Provider Research
- [ ] Document exact historical data limits for each subscription tier
- [ ] Identify security type-specific limitations (stocks vs ETFs vs bonds)
- [ ] Research exchange-specific historical data availability
- [ ] Document any geographic restrictions on historical data
- [ ] Investigate bulk historical data request capabilities

### Alpha Vantage Provider Research
- [ ] Document exact historical data limits for free tier
- [ ] Document exact historical data limits for each premium tier
- [ ] Research the difference between "compact" and "full" output size limitations
- [ ] Investigate daily vs intraday historical data limits
- [ ] Document rate limiting impact on large historical requests

### Implementation Research
- [ ] Implement dynamic limitation detection based on API key/tier
- [ ] Design provider-specific configuration system
- [ ] Create fallback strategies when one provider hits limits
- [ ] Implement progressive data fetching (fetch recent data first, then backfill)
- [ ] Add monitoring and alerting for historical data limit violations

## Future Implementation Strategy

### Dynamic Provider Detection
Once research is complete, implement automatic limitation detection:
```typescript
interface ProviderLimits {
  maxHistoryMonths: number
  tierLevel: 'free' | 'basic' | 'premium' | 'enterprise'
  securityTypeSupport: string[]
  bulkRequestSupport: boolean
}

// Auto-detect limitations based on API key
const eodhdLimits = await detectProviderLimits('eodhd', apiKey)
const alphaVantageLimits = await detectProviderLimits('alpha-vantage', apiKey)
```

### Tiered Fallback Strategy
Implement intelligent fallback when providers hit limitations:
1. Try primary provider (EODHD) with full date range
2. If limited, try with truncated range
3. Fall back to secondary provider (Alpha Vantage) for missing data
4. Use estimation techniques for remaining gaps

### Progressive Data Fetching
For large historical requests:
1. Fetch most recent data first (immediate user feedback)
2. Queue background jobs for historical backfill
3. Update asset values progressively as data becomes available
4. Provide UI indicators for data completeness

## Impact on Other Modules

### Sync Module
- `populateSecurityDailyHistory` respects configured limitations
- Background sync operations work within constraint boundaries
- Asset value calculations handle partial historical data gracefully

### Gateway Module
- Date range validation occurs before API calls
- Consistent limitation enforcement across all providers
- Proper error messaging when limitations are encountered

### Cache Module
- Historical cache population limited by configuration
- No caching of data beyond the configured time horizon
- Cache warming operations respect provider limitations

## Monitoring and Alerts

### Recommended Monitoring
- Track truncation events and their frequency
- Monitor API quota usage against historical data requests
- Alert when approaching provider-specific limitations
- Track data completeness metrics for asset calculations

### Logging Strategy
```typescript
// Example logging when limitations are applied
logger.warn('Historical data request truncated', {
  originalStartDate: requestedStart,
  effectiveStartDate: truncatedStart,
  requestedMonths: requestedMonths,
  maxAllowedMonths: maxHistoryMonths,
  provider: 'eodhd'
})
```

## Related Documentation

- [Price History Caching Strategy](price-history-caching-strategy.md)
- [Securities Service README](../README.md)
- [EODHD Provider README](../eodhd/README.md)
- [Alpha Vantage Provider README](../alpha-vantage/README.md)