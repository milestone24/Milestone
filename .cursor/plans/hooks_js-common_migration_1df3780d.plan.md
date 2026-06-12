---
name: Hooks js-common migration
overview: Migrate the React client's 76 hooks into @milestone/js-common so they can be shared between the web client and the Expo (React Native) app, classifying each hook as move / abstract / leave / split and sequencing the cross-cutting prerequisites first.
todos:
  - id: prereqs
    content: "Build cross-cutting prerequisites: transport adapter for apiRequest/queryClient, notification abstraction replacing use-toast, context strategy for SessionContext/DateRangeContext, and move pure libs (date/user/ocr-inline-job-awaiting) as shared utils"
    status: completed
  - id: move-pure
    content: Move Group B (pure logic/calc) and Group C (use-debounced-value trivial edit) hooks into js-common/src/react/hooks to validate the pipeline
    status: completed
  - id: move-data
    content: Move Group A data/query hooks, repointing @shared/* to relative js-common paths and @server/db/schema to @milestone/data, fixing the two malformed import specifiers
    status: completed
  - id: abstract
    content: Abstract Group D hooks behind injected platform services (storage adapter, file-payload type, socket base URL, platform detection, viewport), consolidating the duplicate use-mobile
    status: completed
  - id: split-charts
    content: Split Group F d3 chart hooks into portable pure-calc hooks (move) and web-only SVG renderers (leave), auditing exact d3 APIs and feeding dimensions in as input
    status: completed
  - id: leave-web
    content: Confirm Group E web-only hooks remain in the client and update their imports if they consume any moved utilities
    status: completed
isProject: false
---

# Hooks to js-common Migration Manifest

Goal: share hook logic between the React web client and the Expo (React Native) app by moving portable hooks into `@milestone/js-common`, abstracting platform-coupled ones behind injected services, and leaving web-only rendering hooks in the client. No code is written until this plan is approved.

Source: `client/src/hooks/*` (76 files). Target: `packages/js-common/src/react/hooks/`.

## Verified dependency facts
- `[client/src/lib/date.ts](client/src/lib/date.ts)` - pure (URL param builder). Portable shared util.
- `[client/src/lib/user.ts](client/src/lib/user.ts)` - pure string replace. Portable.
- `[client/src/lib/ocr-inline-job-awaiting.ts](client/src/lib/ocr-inline-job-awaiting.ts)` - module-level `Set`, pure JS. Portable.
- `[client/src/capacitor.ts](client/src/capacitor.ts)` - entirely `@capacitor/*` bindings + `window.history`. NOT Expo-compatible; drives the `use-mobile-platform` abstraction.
- `[client/src/lib/queryClient.ts](client/src/lib/queryClient.ts)` - `apiRequest` uses raw `fetch` with relative URLs + `credentials:"include"`.

## Legend
- MOVE: relocate to js-common as-is (modulo import repointing). Portable to web + RN.
- MOVE* : moves with one trivial inline edit.
- ABSTRACT: moves only after an injected platform service exists.
- SPLIT: break into a portable pure-calc hook (move) + a web-only render hook (leave).
- LEAVE: stays in web client (DOM/SVG/CSS-var rendering).

## Prerequisites (must land before/with the MOVE group)
1. Transport adapter for `apiRequest`/`queryClient`: injectable base URL + auth transport (web cookies vs RN). Blocks ~44 hooks.
2. Notification abstraction to replace `@/hooks/use-toast` (currently imports web shadcn `@/components/ui/toast`). Blocks ~18 hooks.
3. Context strategy for `SessionContext` and `DateRangeContext` (consumed by session/assets/milestone/fire/chart hooks).
4. Import repointing: `@shared/*` -> relative js-common paths; `@server/db/schema` -> `@milestone/data` (`use-fire`, `use-processes`). Fix malformed specifiers: `"shared/schema"` (missing `@`) in `use-chart-data`, `"@shared/schema/"` (trailing slash) in `use-session`.
5. Move pure libs as shared utils: `@/lib/date`, `@/lib/user`, `@/lib/ocr-inline-job-awaiting`.

## Group A - MOVE (data/query hooks)
use-asset-cash-balance, use-asset-contribution-create/-delete/-update, use-asset-create/-delete/-update, use-asset, use-asset-processes, use-asset-transactions, use-asset-values, use-assets, use-assets-platforms-in-use, use-broker-platforms, use-calculated-asset-transactions, use-connect-asset-api, use-documents, use-asset-ocr-pending-review, use-ocr-job-detail, use-ocr-jobs-list, use-email-ingest-inboxes, use-find-securities, use-fire-settings/-create/-patch, use-milestones, use-milestone-create/-delete/-update, use-portfolio-overview/-range-returns/-transactions/-value, use-process, use-processes (repoint `@server/db/schema`), use-profile, use-projections, use-recurring-contributions, use-securities-update, use-security-transactions, use-transaction-bundle.

Note: the `document` DOM flags on the ocr/documents hooks were false positives from the `@shared/schema/document` import path.

## Group B - MOVE (pure logic / calc)
use-debounce-callback, use-draft-state, use-chart-data (fix `shared/schema` typo), use-fire-chart-data, use-track-chart-data, use-fire-month-over-month-delta, use-fire-preview-projection, use-fire-preview-state, use-fire-projected-retirement-delta, use-fire-retirement-lookback-delta, useDerivedSharePaymentTotal.

## Group C - MOVE* (trivial edit)
- use-debounced-value: replace `window.setTimeout/clearTimeout` with bare `setTimeout/clearTimeout`, then portable.

## Group D - ABSTRACT (inject a platform service)
- use-fire-preferences - `localStorage` -> key/value storage adapter.
- use-standalone-contributors - `localStorage` -> storage adapter.
- use-session - `localStorage` + `wouter` `useLocation` -> storage adapter + navigation injection + SessionContext.
- use-document-upload - `File` + `FormData` + raw fetch -> platform file-payload type + transport.
- use-socket - `window.location` WS URL -> injected socket base URL (`WebSocket` itself RN-safe).
- use-ocr-job-events - `window.location` + `WebSocket` -> injected base URL.
- use-mobile-platform - Capacitor -> platform-detection service (`Platform` on RN).
- use-mobile.ts / use-mobile.tsx - `window.matchMedia/innerWidth/resize` -> viewport service (`useWindowDimensions`); consolidate the duplicate.

## Group E - LEAVE (web-only)
- use-theme-colors - `getComputedStyle` CSS vars + `MutationObserver`.
- use-element-in-view - `IntersectionObserver`.
- use-chart-dimensions - `ResizeObserver`.
- use-d3-render, use-fire-chart-render, use-track-chart-render - d3 DOM selection on SVG.
- use-toast - web shadcn toast (becomes the notification-abstraction source).

## Group F - SPLIT (d3 chart hooks)
Seam: d3 scale/array/shape submodules are pure JS (RN-safe); only d3-selection/DOM is web-only.

- use-chart-scales -> scales MOVE.
- use-chart-interactions -> nearest-point/value math MOVE; `getBoundingClientRect` pointer mapping LEAVE.
- use-d3-render -> geometry derivation (d3-shape, numabbr) MOVE; SVG writes LEAVE.
- use-fire-chart-scales -> MOVE.
- use-fire-chart-render -> geometry MOVE; SVG writes LEAVE.
- use-fire-hero-chart -> decimal.js + scale/geometry MOVE; SVG writes LEAVE.
- use-track-chart-scales -> MOVE.
- use-track-chart-render -> geometry MOVE; SVG writes LEAVE.

Execution notes (deferred): audit each chart hook's exact d3 API calls (everything except `select/append/attr/call` is movable); feed measured `{width,height}` from `use-chart-dimensions` (LEAVE) into moved scale hooks as input; web SVG renderers stay in client; an Expo renderer (react-native-svg / Skia) later consumes the same calc hooks.

## Tally
- MOVE / MOVE*: ~50 hooks (A, B, C)
- ABSTRACT: 9 hooks (D)
- LEAVE: 7 hooks (E)
- SPLIT: 8 hooks (F) -> ~8 pure-calc hooks move, 5 renderers stay

## Suggested execution order
1. Prerequisites (transport adapter, notification abstraction, context strategy, shared pure libs).
2. Group B + Group C (no transport dependency) to validate the js-common react/hooks pipeline.
3. Group A (depends on prerequisites).
4. Group D abstractions, one platform service at a time.
5. Group F splits.
6. Group E stays in client.