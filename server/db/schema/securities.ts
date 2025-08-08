import { InferSelectModel, sql, relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { InferInsertModelBasic, timestampColumns } from "./utils";
import { pgTable, text, uuid, date, decimal, unique } from "drizzle-orm/pg-core";

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

export const securityDailyHistory = pgTable("security_daily_history", {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  securityId: uuid("security_id").notNull().references(() => securities.id),
  date: date("date").notNull(), // DATE type for efficient date queries
  open: decimal("open", { precision: 10, scale: 4 }),
  high: decimal("high", { precision: 10, scale: 4 }),
  low: decimal("low", { precision: 10, scale: 4 }),
  close: decimal("close", { precision: 10, scale: 4 }),
  source: text("source").notNull(), // 'eodhd' | 'alphavantage'
  ...timestampColumns()
}, (table) => [
  // Composite unique constraint to prevent duplicates
  unique("unique_security_date").on(table.securityId, table.date)
]);

export type SecuritySelect = InferSelectModel<typeof securities>;
export type SecurityInsert = InferInsertModelBasic<typeof securities>;

export type SecurityDailyHistorySelect = InferSelectModel<typeof securityDailyHistory>;
export type SecurityDailyHistoryInsert = InferInsertModelBasic<typeof securityDailyHistory>;

export const securityInsertSchema = createInsertSchema(securities);
export const securitySelectSchema = createSelectSchema(securities);

export const securityDailyHistoryInsertSchema = createInsertSchema(securityDailyHistory);
export const securityDailyHistorySelectSchema = createSelectSchema(securityDailyHistory);

// Relations
// Note: securitiesRelations is defined in portfolio-assets.ts to avoid circular imports
// since it needs to reference brokerProvideraAssetSecurities

export const securityDailyHistoryRelations = relations(securityDailyHistory, ({ one }) => ({
  security: one(securities, {
    fields: [securityDailyHistory.securityId],
    references: [securities.id],
  }),
}));
