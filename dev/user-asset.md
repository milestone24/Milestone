
Account Gary 5d4f0f7f-723c-4296-a4cf-d4a7e41db225
Account Chris 11867a08-da4a-49ad-a23b-a3de92febb83
Platform Trading212 f60ee75b-43f5-4449-a671-fba3dcbe07e2
Platform InvestEngine f9e9e99d-e91d-44f1-9758-415cbbf0888b
Platform Vanguard 0257fda4-eed1-4968-a9fb-2ae8b2fc8c35

Chris Invest Egine assets

SIPP

Vanguard FTSE Developed World UCITS ETF USD Accumulation - VHVG
Vanguard FTSE Emerging Markets UCITS ETF USD Accumulation GBP - VFEG

```bash
export USER_ACCOUNT=5d4f0f7f-723c-4296-a4cf-d4a7e41db225
export PLATFORM_ID=f60ee75b-43f5-4449-a671-fba3dcbe07e2
```



```bash
npm run accounts:add-user-asset -- \
  --user-account-id "$USER_ACCOUNT" \
  --platform-id "$PLATFORM_ID" \
  --name "GAry OCR TEST" \
  --account-type SIPP \
  --start-date 2026-04-01 \
  --symbols VHVG,VFEG

npm run accounts:add-user-asset -- \
  --user-account-id "$USER_ACCOUNT" \
  --platform-id "$PLATFORM_ID" \
  --name "GAry OCR TEST" \
  --account-type SIPP \
  --start-date 2026-04-01 \
  --symbols MSFT,HEIA \
  --find-securities
  ```