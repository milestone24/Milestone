# Financial Decimal Precision Standards

Industry standards and regulatory requirements for decimal precision in securities and financial data systems.

---

## Share Quantity Precision

### Regulatory Standards

**FINRA (Financial Industry Regulatory Authority)**
- Standard precision for fractional share quantity reporting in U.S. equity markets: **6 decimal places**
- This requirement became effective **February 23, 2026** for NMS stock transactions
- Member firms must report fractional share quantities to 6 digits after the decimal point
- Reporting targets: CAT (Central Repository), TRF (Trade Reporting Facilities), ORF (OTC Reporting Facility)
- Source: [FINRA Trade Reporting Notice 1/14/26](https://www.finra.org/rules-guidance/notices/trade-reporting-notice-20260114)

**FIX Protocol (Financial Information Exchange)**
- The de-facto financial messaging standard for institutional trading
- Quantity fields (`Qty`) are specified as `float` supporting **up to 15 significant digits**
- The number of decimal places is determined by business/market needs and mutual agreement between counterparties
- No single mandated decimal count; supports fractional units as required
- Source: [FIX Latest Datatypes](https://fiximate.fixtrading.org/en/FIX.Latest/fix_datatypes.html)

### Broker-Level Precision (Observed)

| Broker | Fractional Share Precision |
|---|---|
| Robinhood | 6 decimal places (0.000001) |
| Interactive Brokers | 4 decimal places (0.0001) |
| E\*Trade | Up to 5 decimal places |
| Fidelity | 3 decimal places (0.001) |

Source: [Quant StackExchange – Precision Standards](https://quant.stackexchange.com/questions/60542/are-there-any-standards-for-the-precision-of-stocks-prices-amount-of-stocks-etc)

---

## Price and Monetary Precision

### SEC Minimum Pricing Increment (Rule 612)

- Securities priced **above $1.00**: minimum increment of **$0.01** (2 decimal places)
- Securities priced **below $1.00**: minimum increment of **$0.0001** (4 decimal places)
- Source: SEC Rule 612 (Sub-Penny Rule)

### Market Reporting Precision

- **NASDAQ** reporting standard: typically **4 decimal places**
- Actual execution prices have been observed up to **6 decimal places** in practice
- UTP (Unlisted Trading Privileges) binary output specifications support fractional price reporting at similar precision

---

## Integer Range Considerations

When designing storage for share quantities and monetary values, both the fractional precision and the maximum whole number range must be considered:

### Share Quantities

- Institutional holdings can reach tens or hundreds of millions of shares
- Example: a large institutional position may be 50,000,000+ shares (8 integer digits)
- Fractional precision requirement: 6–8 decimal places

### Monetary Values

- Portfolio or trade values can reach hundreds of millions in a single account
- Currency conversion, fees, and sub-dollar securities require 4 decimal places
- Example: a large trade value may be £50,000,000.00 (8 integer digits before decimal)

---

## Summary Table

| Data Type | Integer Digits Needed | Decimal Digits Needed | Standard/Source |
|---|---|---|---|
| Share quantity | 8–10 (millions to billions) | 6 (FINRA mandate, 2026) | FINRA, FIX Protocol |
| Security price | 6–8 | 4 (sub-dollar SEC Rule 612) | SEC Rule 612, NASDAQ |
| Currency/monetary value | 8–14 | 2–4 | SEC Rule 612 |
| Fees | 6–8 | 4 | SEC Rule 612 |
