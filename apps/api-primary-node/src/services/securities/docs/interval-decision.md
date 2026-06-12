# Intraday Interval Decision: 15-Minute Minimum

## Overview

This document explains the decision-making process for setting the minimum intraday interval to 15 minutes when using Alpha Vantage's "compact" output size.

## Problem Statement

We needed to optimize our intraday data retrieval from Alpha Vantage while ensuring we always get complete daily data. The challenge was balancing API efficiency (using "compact" output) with data completeness.

## Alpha Vantage Compact Output Analysis

**"compact" output provides 100 data points maximum:**

| Interval | 100 Points Coverage | Trading Day Coverage | Sufficient for Full Day? |
|----------|-------------------|---------------------|-------------------------|
| **1min** | ~1.67 hours | ~10% of trading day | ❌ **No** |
| **5min** | ~8.33 hours | ~52% of trading day | ❌ **No** |
| **15min** | 25 hours | 156% of trading day | ✅ **Yes** |
| **30min** | 50 hours | 312% of trading day | ✅ **Yes** |
| **60min** | 100 hours | 625% of trading day | ✅ **Yes** |

## Trading Day Reality

- **Typical US Market Hours**: ~16 hours (4:00 AM - 8:00 PM ET)
- **Pre-market**: 4:00 AM - 9:30 AM ET (5.5 hours)
- **Regular trading**: 9:30 AM - 4:00 PM ET (6.5 hours)  
- **After-hours**: 4:00 PM - 8:00 PM ET (4 hours)

## Decision Criteria

1. **Data Completeness**: Must ensure we get full trading day coverage
2. **API Efficiency**: Prefer "compact" over "full" to reduce payload size and costs
3. **Performance**: Faster response times with smaller data sets
4. **Cost Optimization**: Fewer data points = lower API call costs
5. **Reliability**: Consistent data availability across all intervals

## Why 15 Minutes Minimum?

**✅ 15-minute intervals with "compact":**
- Provides 25 hours of data (156% of trading day)
- Guarantees complete daily coverage even on extended trading days
- Efficient API usage with manageable data volume
- Good balance between granularity and performance

**❌ 1-minute and 5-minute intervals with "compact":**
- Would only provide partial day coverage
- Would require "full" output size for complete data
- Larger payload sizes and higher costs
- Potential for incomplete data on busy trading days

## Alternative Considered: Dynamic Output Size

We considered implementing dynamic output size selection based on interval:
- Use "compact" for 15min+ intervals
- Use "full" for 1min/5min intervals

**Rejected because:**
- Added complexity to the API
- Inconsistent behavior across intervals
- Higher costs for high-frequency data
- Potential confusion for API users

## Final Decision: 15-Minute Minimum

**Benefits:**
1. **Guaranteed Completeness**: Always get full trading day data
2. **Consistent Efficiency**: Always use "compact" output
3. **Cost Effective**: Optimal balance of data granularity and API efficiency
4. **Simple API**: Clear, predictable behavior across all intervals
5. **Future-Proof**: Handles extended trading hours and market volatility

**Trade-offs:**
1. **Reduced Granularity**: No 1-minute or 5-minute data available
2. **Less Detail**: 15-minute intervals provide less fine-grained analysis
3. **Limited Options**: Fewer interval choices for users

## Implementation Impact

This decision affects:
- **Type Definitions**: `IntradayInterval` now only includes `'15min' | '30min' | '60min'`
- **Default Behavior**: All intraday calls default to 15-minute intervals
- **API Consistency**: Both Alpha Vantage and EODHD use the same interval range
- **Documentation**: Updated to reflect new interval options and reasoning

## User Impact

**Positive:**
- More reliable data (always complete daily coverage)
- Faster API responses (smaller payloads)
- Lower costs (fewer data points per request)
- Consistent behavior across providers

**Considerations:**
- Users needing 1-minute data will need to use alternative solutions
- Historical data analysis may have less granularity
- Real-time trading applications may need higher frequency data

## Conclusion

This decision prioritizes **reliability and efficiency** over maximum granularity, ensuring our API provides consistent, complete data while optimizing for performance and cost.

## Related Documentation

- [Main Securities Service README](../README.md)
- [Alpha Vantage Service README](../alpha-vantage/README.md)
- [EODHD Service README](../eodhd/README.md) 