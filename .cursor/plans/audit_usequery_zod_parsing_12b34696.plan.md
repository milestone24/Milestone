---
name: Audit useQuery Zod Parsing
overview: Audit of all `useQuery` call sites in the client that do not parse their API response with a Zod schema and `safeParse`. Categorised by active usage so priority can be assigned.
todos:
  - id: audit-note
    content: This is an audit plan only — no implementation tasks until user confirms scope and priority order
    status: pending
isProject: false
---

# useQuery Zod `safeParse` Audit

## Already Parsed (baseline — do not touch)


| File                                     | Schema used                                                      |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `use-session.ts`                         | `sessionResponseSchema.safeParse()`                              |
| `use-fire-settings.ts`                   | `fireSettingsOrphanSchema.safeParse()`                           |
| `use-asset.ts`                           | `resolvedUserAssetSchema.safeParse()`                            |
| `use-assets.ts`                          | `userAssetWithValueChangeSchema.array().safeParse()`             |
| `use-security-transactions.ts`           | `userAssetSecurityTransactionResolvedSchema.array().safeParse()` |
| `use-projections.ts → useFIREProjection` | `fireProjectionSchema.safeParse()`                               |
| `AssetSecuritiesContext.tsx`             | `resolvedAssetSecuritiesSchema.safeParse()`                      |
| `TransactionsPanel.tsx`                  | `assetTransactionSelectSchema.array().safeParse()`               |


---

## Missing Zod Parsing — Active hooks (used in UI)

- `[use-broker-platforms.ts](client/src/hooks/use-broker-platforms.ts)` — `GET /api/assets/broker-platforms` → `BrokerPlatform[]`
  - Used in: `portfolio.tsx`, `AccountCreate.tsx`, `ScreenshotUpload.tsx`
- `[use-broker-providers.ts](client/src/hooks/use-broker-providers.ts)` — `GET /api/assets/broker-providers` → `BrokerProvider[]`
  - Used in: `asset-security.tsx`, `record.tsx`, `ScreenshotUpload.tsx`
- `[use-asset-values.ts](client/src/hooks/use-asset-values.ts)` — `GET /api/assets/${assetId}/history` → `AssetValue[]`
  - Used in: `asset.tsx`, `AssetValueUpsertDialog.tsx`, `AssetValueListItem.tsx`
- `[use-find-securities.ts](client/src/hooks/use-find-securities.ts)` — `GET /api/securities/search?q=` → `SecuritySearchResult[]`
  - Used in: `AssetSecurityForm.tsx`
- `[use-portfolio-transactions.ts](client/src/hooks/use-portfolio-transactions.ts)` — `GET /api/assets/portfolio-value/transactions` → `TransactionTimePoint[]`
  - Used in: `portfolio.tsx`
- `[use-portfolio-value.ts](client/src/hooks/use-portfolio-value.ts)` — `GET /api/assets/portfolio-value` → `PortfolioValue`
  - Used in: `portfolio.tsx`
- `[use-portfolio-overview.ts](client/src/hooks/use-portfolio-overview.ts)` — `GET /api/assets/portfolio-overview` → `ValueChange`
  - Used in: `portfolio.tsx`, `goals.tsx`, `track.tsx`, `AISuggestedMilestones.tsx`
- `[use-asset-transactions.ts](client/src/hooks/use-asset-transactions.ts)` — `GET /api/assets/${assetId}/transactions/graph` → `TransactionTimePoint[]`
  - Used in: `asset.tsx`
- `[use-recurring-contributions.ts](client/src/hooks/use-recurring-contributions.ts)` — `GET /api/assets/${assetId}/recurring-contributions` → `RecurringContribution[]`
  - Used in: `TransactionsPanel.tsx`, `RecurringContributionItem.tsx`, `SecuritiesTransactionsPanel.tsx`
- `[use-processes.ts](client/src/hooks/use-processes.ts)` — `GET /api/tracking/processes` → `Process[]` (local empty type)
  - Used in: `ValuesChart.tsx`
- `[PortfolioContext.tsx](client/src/context/PortfolioContext.tsx)` — `GET /api/milestones/user/${userId}` → `Milestone[]`
  - Used across many pages via `usePortfolio()`

---

## Missing Zod Parsing — Direct `useQuery` in pages/components (not via custom hook)

- `[asset-security.tsx](client/src/pages/asset-security.tsx)`
  - Query A: `GET /api/assets/${assetId}/securities/${nestedId}` → `ResolvedAssetSecurity`
  - Query B: `GET /api/assets/${assetId}/history` → `AssetValue[]`
- `[asset.tsx](client/src/pages/asset.tsx)` — uses raw `fetch` (not `apiRequest`) → `AssetValueTimePoint[]`
  - Note: does not include `assetId` in query key — possible bug
- `[portfolio.tsx](client/src/pages/portfolio.tsx)` — uses raw `fetch` (not `apiRequest`) → `AssetValueTimePoint[]`

---

## Missing Zod Parsing — Unused / low-priority

- `[use-securities-search.ts](client/src/hooks/use-securities-search.ts)` — duplicate of `use-find-securities.ts`, hook does not even return the query result. Appears dead code.
- `[use-process.ts](client/src/hooks/use-process.ts)` — `GET /api/tracking/processes/${processId}` → no imports found, appears unused.
- `[use-projections.ts](client/src/hooks/use-projections.ts)` — the following internal hooks have no Zod and no external imports:
  - `useAssetProjection`
  - `usePortfolioProjection`
  - `useMilestoneProjection`
  - `useMilestonesProjection`
  - `useCustomFIREProjection`
  - `usePortfolioWithMilestoneProjection`

