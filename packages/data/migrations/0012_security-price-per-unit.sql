-- Step 1: add column as nullable so existing rows are unaffected
ALTER TABLE "security_transactions" ADD COLUMN "per_unit_value" numeric(18, 4);

-- Step 2: back-fill from existing data — price per unit = |currency_value| / |value|
--         CASE guard handles the degenerate zero-shares row (should not exist in practice)
UPDATE "security_transactions"
SET "per_unit_value" = CASE
  WHEN "value" != 0 THEN ABS("currency_value" / "value")
  ELSE 0
END
WHERE "per_unit_value" IS NULL;

-- Step 3: enforce NOT NULL now that every row has a value
ALTER TABLE "security_transactions" ALTER COLUMN "per_unit_value" SET NOT NULL;
