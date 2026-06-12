-- Migration: Remove CISA account type from the system
-- Safe migration that converts all CISA references to ISA, then removes CISA from the enum
-- 
-- IMPORTANT: Run this in a transaction and verify data before committing

BEGIN;

-- Step 1: Verify current state (optional, for safety)
-- SELECT DISTINCT account_type, COUNT(*) FROM user_assets GROUP BY account_type;
-- SELECT DISTINCT unnest(supported_account_types) as account_type, COUNT(*) FROM broker_platforms GROUP BY 1;
-- SELECT DISTINCT unnest(supported_account_types) as account_type, COUNT(*) FROM broker_providers GROUP BY 1;

-- Step 2: Update user_assets - convert any CISA to ISA
UPDATE user_assets 
SET account_type = 'ISA'::account_type 
WHERE account_type = 'CISA'::account_type;

-- Step 3: Update broker_platforms - remove CISA from supported_account_types arrays
UPDATE broker_platforms 
SET supported_account_types = array_remove(supported_account_types, 'CISA'::account_type)
WHERE 'CISA'::account_type = ANY(supported_account_types);

-- Step 4: Update broker_providers - remove CISA from supported_account_types arrays
UPDATE broker_providers 
SET supported_account_types = array_remove(supported_account_types, 'CISA'::account_type)
WHERE 'CISA'::account_type = ANY(supported_account_types);

-- Step 5: Update milestones (text column) - convert any CISA to ISA
UPDATE milestones 
SET account_type = 'ISA' 
WHERE account_type = 'CISA';

-- Step 6: Recreate the enum without CISA
-- PostgreSQL doesn't allow removing enum values directly, so we need to recreate it

-- 6a: Rename the old enum
ALTER TYPE account_type RENAME TO account_type_old;

-- 6b: Create the new enum without CISA
CREATE TYPE account_type AS ENUM ('ISA', 'SIPP', 'LISA', 'GIA', 'OTHER');

-- 6c: Update user_assets column to use the new enum
ALTER TABLE user_assets 
ALTER COLUMN account_type TYPE account_type 
USING account_type::text::account_type;

-- 6d: Update broker_platforms column to use the new enum
ALTER TABLE broker_platforms 
ALTER COLUMN supported_account_types TYPE account_type[] 
USING supported_account_types::text[]::account_type[];

-- 6e: Update broker_providers column to use the new enum
ALTER TABLE broker_providers 
ALTER COLUMN supported_account_types TYPE account_type[] 
USING supported_account_types::text[]::account_type[];

-- 6f: Drop the old enum
DROP TYPE account_type_old;

-- Step 7: Verify the migration (optional)
-- SELECT unnest(enum_range(NULL::account_type));
-- SELECT DISTINCT account_type FROM user_assets;

COMMIT;
