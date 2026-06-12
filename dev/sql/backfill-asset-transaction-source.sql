-- psql $DATABASE_URL -f dev/sql/backfill-asset-transaction-source.sql

UPDATE asset_transactions
SET source = 'manual'
WHERE source IS NULL;

UPDATE security_transactions
SET source = 'manual'
WHERE source IS NULL;
