. Interval Options
Current State:
EODHD: Hardcoded to 1m
Alpha Vantage: Hardcoded to 1min
Proposed Standardization:
'
Benefits:
Both APIs support similar interval ranges
Consistent naming convention
User can choose granularity based on needs
2. Date Range vs Single Date
Current State:
EODHD: Uses from/to Unix timestamps (date range)
Alpha Vantage: Uses single date filtering
Proposed Standardization:
)
3. Output Size/Data Limit
Current State:
EODHD: No explicit limit (uses date range)
Alpha Vantage: outputsize: 'full' vs 'compact'
Proposed Standardization:
'
4. Exchange/Market Specification
Current State:
EODHD: .US suffix hardcoded
Alpha Vantage: No exchange specification
Proposed Standardization:
.
5. Response Format
Current State:
EODHD: fmt=json (hardcoded)
Alpha Vantage: Always JSON
Proposed Standardization:
extensibility


## Exchnage Parameter

ok, now lets consider the requirement for exchnage suffix for eodhd.
In reference to our "findSecurities" methods we know that search results from eodhd have an exchange field that would be used for the suffix.
So we have to think about what we give the high level Intraday function as the argument for the symbol

1) Use string with exchnage suffix attached - "have to be careful of some symbols already having dot delemiter" "Check how alpha vnatage returns teh exchange in search results"
2) Use object with name and exchange fields
3) Use object with name and exchange fields and allow for dynamic suffix


## API provider specific armuments

Either
1) addional optional args for on individual provider methods (ie eodhd, or alphavantge) so they can ce called directly with more native arguments
2) we overload the function to accept different args
3) we use an object for single argument that is dynamic



Exchange Mapping: Map Alpha Vantage suffixes to EODHD exchange codes
Symbol Normalization: Consistent symbol handling across providers
Dynamic Exchange Loading: Use EODHD's Exchanges API for up-to-date information