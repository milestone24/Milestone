

Account Gary 5d4f0f7f-723c-4296-a4cf-d4a7e41db225
Account Chris 11867a08-da4a-49ad-a23b-a3de92febb83
Platform Trading f60ee75b-43f5-4449-a671-fba3dcbe07e2
Platform InvestEngine f9e9e99d-e91d-44f1-9758-415cbbf0888b
Platform Vanguard 0257fda4-eed1-4968-a9fb-2ae8b2fc8c35

Asset Chris InvestEngine 547962dc-6b42-4a35-96f1-0b4375fc0338

setup
```bash

# Chris Vanguard
export PLATFORM_ID=f9e9e99d-e91d-44f1-9758-415cbbf0888b
export USER_ACCOUNT=11867a08-da4a-49ad-a23b-a3de92febb83
export ASSET_ID=547962dc-6b42-4a35-96f1-0b4375fc0338

export STATEMENT_PDF="./dev/statements/Fwd Your portfolio has been updated.pdf"
export PLATFORM_NAMES="InvestEngine"

# Optional: `dev/test-ocr.ts` reads these when you omit CLI flags (see script help).
# export OCR_TEST_ACCOUNT_ID="$USER_ACCOUNT"
# export OCR_TEST_NOMINATED_USER_ASSET_ID="$ASSET_ID"

```

Unknown platform (`platformKey` defaults to `unknown` when `--platform` is omitted — brand 3c has no configured broker UUID; still pass `--names` if you want balance extraction hints)
```bash
npx tsx dev/test-ocr.ts \
  --mode pipeline \
  --verbose \
  --account-id "$USER_ACCOUNT" \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

```bash
export OCR_TEST_ACCOUNT_ID="$USER_ACCOUNT"
npx tsx dev/test-ocr.ts \
  --mode pipeline \
  --verbose \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

Balances only without `--platform` (same default `unknown`)
```bash
npx tsx dev/test-ocr.ts \
  --mode balances \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

Balances-prepared, unknown platform + abort smoke
```bash
npx tsx dev/test-ocr.ts \
  --mode balances-prepared \
  --names "$PLATFORM_NAMES" \
  --abort-after-ms 120000 \
  "$STATEMENT_PDF"
```

Pipeline (full OCR — same as `--spike1`; uses explicit account)
```bash
npx tsx dev/test-ocr.ts \
  --mode pipeline \
  --verbose \
  --account-id "$USER_ACCOUNT" \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

Pipeline via env default account (`OCR_TEST_ACCOUNT_ID`)
```bash
export OCR_TEST_ACCOUNT_ID="$USER_ACCOUNT"
npx tsx dev/test-ocr.ts \
  --mode pipeline \
  --verbose \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

Pipeline with nominated user asset (mirrors asset-scoped extract context)
```bash
export OCR_TEST_ACCOUNT_ID="$USER_ACCOUNT"
export OCR_TEST_NOMINATED_USER_ASSET_ID="$ASSET_ID"
npx tsx dev/test-ocr.ts \
  --mode pipeline \
  --verbose \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

Balances only (no DB; default mode if you omit `--mode`)
```bash
npx tsx dev/test-ocr.ts \
  --mode balances \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```

Balances via prepared path (same outcome as balances; use for `--abort-after-ms` on the balance LLM only)
```bash
npx tsx dev/test-ocr.ts \
  --mode balances-prepared \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  --abort-after-ms 120000 \
  "$STATEMENT_PDF"
```

Prepare only (document blocks + meta JSON to stdout; no Anthropic)
```bash
npx tsx dev/test-ocr.ts --mode prepare "$STATEMENT_PDF"
```

Dump native PDF transcript (stdout = text, stderr = JSON metadata)
```bash
npx tsx dev/test-ocr.ts --mode dump-text "$STATEMENT_PDF"
```

Pipeline with early abort (cooperative cancel / timeout-style check)
```bash
export OCR_TEST_ACCOUNT_ID="$USER_ACCOUNT"
npx tsx dev/test-ocr.ts \
  --mode pipeline \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  --abort-after-ms 5000 \
  "$STATEMENT_PDF"
```

Legacy shorthand (`--spike1` implies pipeline when `--mode` is omitted)
```bash
npx tsx dev/test-ocr.ts \
  --spike1 \
  --verbose \
  --account-id "$USER_ACCOUNT" \
  --platform "$PLATFORM_ID" \
  --names "$PLATFORM_NAMES" \
  "$STATEMENT_PDF"
```


```sql
SELECT
  uas.id                    AS user_asset_security_id,
  uas.user_asset_id,
  uas.security_id,
  s.symbol,
  s.exchange,
  s.name                    AS security_name
FROM user_asset_securities AS uas
JOIN securities AS s ON s.id = uas.security_id
WHERE s.name ILIKE '%Vanguard%'
  AND uas.archived = false
ORDER BY s.name;
```

```bash
psql "$DATABASE_URL" -c "SELECT uas.id, uas.user_asset_id, s.symbol, s.exchange, s.name, s.isin FROM user_asset_securities uas JOIN securities s ON s.id = uas.security_id WHERE s.name ILIKE '%Vanguard%' AND uas.archived = false ORDER BY s.name;"
```

User assets with broker platform name (SQL client: substitute your `user_accounts.id`; matches Chris row above)
```sql
SELECT
  ua.id                    AS user_asset_id,
  ua.name                  AS user_asset_name,
  ua.user_account_id,
  ua.platform_id           AS broker_platform_id,
  bp.name                  AS platform_name,
  ua.account_type
FROM user_assets AS ua
LEFT JOIN broker_platforms AS bp ON bp.id = ua.platform_id
WHERE ua.user_account_id = '11867a08-da4a-49ad-a23b-a3de92febb83'
ORDER BY ua.name;
```

```bash
psql "$DATABASE_URL" -c "SELECT ua.id AS user_asset_id, ua.name AS user_asset_name, ua.user_account_id, ua.platform_id AS broker_platform_id, bp.name AS platform_name, ua.account_type FROM user_assets ua LEFT JOIN broker_platforms bp ON bp.id = ua.platform_id WHERE ua.user_account_id = '$USER_ACCOUNT' ORDER BY ua.name;"
```

```bash
psql


                  id                  |            user_asset_id             | symbol | exchange |                             name                              |     isin
--------------------------------------+--------------------------------------+--------+----------+---------------------------------------------------------------+--------------
 8db35fe7-c8c3-47bb-a2e2-49a2efd97c3b | 547962dc-6b42-4a35-96f1-0b4375fc0338 | VHVG   | LSE      | Vanguard FTSE Developed World UCITS ETF USD Accumulation      | IE00BK5BQV03
 42776ef7-bc4e-4553-a6c3-a13682a85400 | 17197d3c-ef61-4493-a9ae-c0520e18d069 | VEVE   | SW       | Vanguard FTSE Developed World UCITS ETF USD Distributing CHF  | IE00BKX55T58
 c1b2a3c7-3b3e-4013-ae48-32ac1bfbbab4 | 547962dc-6b42-4a35-96f1-0b4375fc0338 | VFEG   | LSE      | Vanguard FTSE Emerging Markets UCITS ETF USD Accumulation GBP | IE00BK5BQV03
(3 rows)

IE00BK5BQV03\
