import { InferInsertModel, InferSelectModel, sql,  } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const securities = pgTable("securities", {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sourceIdentifier: text("sourceIdentifier").notNull(), // e.g., "eodhd", "alphavantage"
  symbol: text("symbol").notNull(), // e.g., "AAPL", "VWRL.L"
  name: text("name").notNull(), // e.g., "Apple Inc.", "Vanguard FTSE All-World UCITS ETF"
  exchange: text("exchange"), // e.g., "NASDAQ", "LSE"
  country: text("country"), // e.g., "US", "UK"
  currency: text("currency"), // e.g., "USD", "GBP"
  type: text("type"), // e.g., "Common Stock", "ETF", "Fund"
  isin: text("isin"), // International Securities Identification Number
  cusip: text("cusip"), // Committee on Uniform Securities Identification Procedures
  figi: text("figi"), // Financial Instrument Global Identifier
  ...timestampColumns()
});

export type SecuritySelect = InferSelectModel<typeof securities>;
export type SecurityInsert = InferInsertModelBasic<typeof securities>;

export const securityInsertSchema = createInsertSchema(securities);
export const securitySelectSchema = createSelectSchema(securities);
