# Securities Service Documentation

This directory contains important documentation for the Securities Service, including design decisions, architectural choices, and implementation details.

## Available Documentation

### [Interval Decision Documentation](interval-decision.md)
**Purpose**: Explains the decision-making process for setting the minimum intraday interval to 15 minutes when using Alpha Vantage's "compact" output size.

**Key Topics**:
- Analysis of Alpha Vantage compact output limitations
- Trading day coverage calculations
- Decision criteria and alternatives considered
- Implementation impact and user considerations

**When to Read**: 
- When implementing new intraday functionality
- When considering changes to interval options
- When explaining the API design to stakeholders
- When troubleshooting data completeness issues

### [Exchange Handling Documentation](exchange-handling.md)
**Purpose**: Records the discussion and decision-making process for handling exchange suffixes in intraday functions, particularly for EODHD which requires exchange information.

**Key Topics**:
- Analysis of current hardcoded `.US` suffix issue
- Provider exchange information differences (EODHD vs Alpha Vantage)
- Three options considered for exchange handling
- Recommended solution with implementation strategy

**When to Read**: 
- When implementing exchange-aware functionality
- When working with international securities
- When designing new API interfaces
- When troubleshooting exchange-related issues

### [EODHD Exchange Codes Reference](eodhd-exchange-codes.md)
**Purpose**: Comprehensive reference for EODHD exchange codes used in API calls and data responses.

**Key Topics**:
- Complete list of supported exchanges with EODHD codes and MIC codes
- Usage examples for different API endpoints
- Important notes about virtual exchanges and multiple MIC codes

**When to Read**: 
- When working with EODHD API calls
- When constructing exchange-specific URLs
- When mapping exchange information from search results
- When implementing international securities support

### [Daily Price History Caching Strategy](price-history-caching-strategy.md)
**Purpose**: Documents the design and implementation strategy for caching daily price history data to reduce API load and improve performance.

**Key Topics**:
- Database schema design for daily price history storage
- Cache-first approach with API fallback strategy
- Performance considerations and indexing strategy
- Implementation phases and integration points

**When to Read**: 
- When implementing price history caching functionality
- When optimizing API usage and performance
- When designing database schema for financial data
- When planning cache warming and management strategies

## Documentation Standards

All documentation in this directory should:
- Be written in Markdown format
- Include clear problem statements and solutions
- Provide implementation context and impact
- Reference related code and other documentation
- Be kept up-to-date with code changes

## Contributing

When adding new documentation:
1. Create a descriptive filename
2. Include a clear title and overview
3. Explain the problem, solution, and rationale
4. Add references to related documentation
5. Update this README with the new document 