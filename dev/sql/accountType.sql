-- Migration: Convert user_assets.account_type from text to enum
-- This migration handles the conversion of the account_type column from text to the account_type enum

-- Optional: Run this first to see what values exist before migration
-- SELECT DISTINCT account_type, COUNT(*) FROM user_assets GROUP BY account_type;

-- Step 1: Create the enum type if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('ISA', 'CISA', 'SIPP', 'LISA', 'GIA', 'OTHER');
    END IF;
END$$;

-- Step 2: Handle any invalid text values that don't match the enum
-- Maps unrecognized values to 'OTHER' so the cast in step 3 won't fail
UPDATE user_assets 
SET account_type = 'OTHER' 
WHERE account_type NOT IN ('ISA', 'CISA', 'SIPP', 'LISA', 'GIA')
  AND account_type != 'OTHER';

-- Step 3: Alter the column to use the enum type
ALTER TABLE user_assets 
ALTER COLUMN account_type TYPE account_type 
USING account_type::account_type;
