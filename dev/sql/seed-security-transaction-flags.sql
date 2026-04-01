-- psql $DATABASE_URL -f dev/sql/seed-security-transaction-flags.sql
--
-- Assigns random flags to all security_transactions for development/testing.
-- Each flag is independently randomised:
--   estimated: ~30% chance
--   suspect:   ~15% chance
--   verified:  ~20% chance
-- Rows where no flags are drawn result in NULL (not an empty object).

UPDATE security_transactions
SET flags = NULLIF(
  jsonb_strip_nulls(
    jsonb_build_object(
      'estimated', CASE WHEN random() < 0.30 THEN true ELSE NULL END,
      'suspect',   CASE WHEN random() < 0.15 THEN true ELSE NULL END,
      'verified',  CASE WHEN random() < 0.20 THEN true ELSE NULL END
    )
  ),
  '{}'::jsonb
);
