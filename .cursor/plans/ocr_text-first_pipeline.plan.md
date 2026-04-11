---
name: OCR text-first pipeline and capture schema
overview: Improve extraction quality via native PDF text + multi-step LLM, evolve capture types for security_transactions (DB + shared Zod), reserve a processing path for email-origin OCR input (how email is received—not yet decided). Foundation is a plain TypeScript LlmGateway (Anthropic); product features (dual-track payload, resolution, persistence, client review) are the current priority. A second gateway provider and LangGraph evaluation are deferred until the product pipeline is stable end-to-end.
todos:
  - id: schema-gap-analysis
    content: Define shared Zod for OCR security-transaction candidates vs securityTransactionOrphanInsertSchema; document resolution path to assetSecurityId
    status: completed
  - id: pdf-text-module
    content: Add PDF native text extraction + isTextSufficient heuristic; choose library after ESM compatibility check
    status: completed
  - id: ocr-service-split
    content: Refactor OcrService — extractFromTranscript, extractFromVision, extract orchestration
    status: completed
  - id: pipeline-wire-logging
    content: "Done: document-ocr handler logs path/charCount/row counts; document-ocr-completed carries pipeline; dev/test-ocr --verbose (LLM + 4c diagnostics); dev/test-ocr --dump-text (native PDF transcript)"
    status: completed
  - id: ocr-cli-dump-text
    content: "dev/test-ocr.ts --dump-text — native PDF transcript to stdout (stderr JSON meta); unpdf + same thresholds as OCR"
    status: completed
  - id: orchestration-spike-1-ts-gateway
    content: "LlmGateway (Anthropic) + explicit TS orchestration in runFullDocumentOcrPipeline — docs/Transaction-OCR-flow 3a–3c, 4a–4c + balances; shared Zod for brand + securities; wired in document-ocr handler."
    status: completed
  - id: ocr-jobs-schema
    content: "ocr_jobs Drizzle schema — document_id FK SET NULL, process_id FK SET NULL, platform_key, status (reuse processStatus enum), extracted_values jsonb, pipeline jsonb, error, started_at, completed_at; exported from server/db/schema/index.ts"
    status: completed
  - id: ocr-jobs-wire-handler
    content: "Wire document-ocr-distributed-handler to insert/update ocr_jobs on start, complete and fail; persistence must not rely solely on the queue message"
    status: pending
  - id: product-dual-track
    content: "Clarify Record asset-values OCR vs security-transaction OCR — decide payload shape (securityCandidates field on document-ocr-completed vs separate mode/route); securityHoldings are currently computed and dropped downstream."
    status: pending
  - id: candidate-resolution
    content: "Resolution step: map verified OCR candidate { symbol, isin, name } + userAccountId → assetSecurityId (securities cache / DB); prerequisite for persistence."
    status: pending
  - id: candidate-persistence
    content: "Persist resolved security transaction candidates as security_transactions rows with source: ocr after 4c + resolution; no write path exists today."
    status: pending
  - id: client-candidate-review
    content: "Client UI: surface security transaction candidates to user for confirmation before insert; handle unresolved candidates (new security not yet in portfolio)."
    status: pending
  - id: phase2-verify
    content: Optional groundedness verify pass + feature flag (second LLM pass after 4a to flag suspect rows)
    status: pending
  - id: email-origin-ocr-path
    content: Define server-side processing entry for email-sourced statements (normalised to documents + same document-ocr flow); do not implement email receipt (HTTP vs provider vs other) until ingestion is decided
    status: pending
  - id: orchestration-spike-1-exit-provider
    content: "Deferred — second LlmGateway adapter (e.g. Ollama HTTP text) to prove gateway swap cost; revisit after product pipeline is end-to-end."
    status: pending
  - id: orchestration-spike-2-langgraph
    content: "Deferred — time-boxed LangGraph (+ LangChain chat models) evaluation on one vertical slice; revisit only once the plain TS pipeline is stable end-to-end and a second provider is warranted."
    status: pending
  - id: phase3-raster-ocr
    content: Optional Tesseract/managed OCR when PDF text layer insufficient
    status: pending
isProject: false
---

# OCR text-first pipeline and security-transaction capture schema

**Related:**

- [DocumentUpload OCR Refactor — Phase 2](documentupload_ocr_refactor_1e50c3b2.plan.md) (current wire-up uses `ExtractedAmount[]`, which is insufficient for securities).
- **Transaction OCR flow (canonical mermaid):** [`docs/Transaction-OCR-flow.md`](../../docs/Transaction-OCR-flow.md) — document-first, multi-phase AI orchestration (brand / platform then securities), DB and schema verification steps; extend that file as the pipeline evolves.

---

## Problem: current capture schema vs domain target

Today [`extractedAmountSchema`](shared/schema/document.ts) captures:

- `platformName`, `amount`, `confidence`, optional `accountType`

That shape fits **account-level** snapshots (e.g. Record page totals per asset), not **security-level** rows that can populate [`security_transactions`](server/db/schema/portfolio-assets.ts).

### Database: `security_transactions`

Defined in [`server/db/schema/portfolio-assets.ts`](server/db/schema/portfolio-assets.ts) (`securityTransactions`):

| Column | Role |
|--------|------|
| `assetSecurityId` | FK to `user_asset_securities` — **not** extractable from a PDF alone; requires resolution (user portfolio + security identity). |
| `value` | **Number of shares held** (`brandedDecimal`, not null). |
| `currencyValue` | Monetary value (`brandedDecimal`, not null). |
| `fees` | Optional decimal. |
| `currency` | Text (default `GBP`). |
| `valueDate` | As-of date for the holding/snapshot. |
| `recordedAt` | When recorded. |
| `source` | `manual` \| `recurring` \| **`ocr`** \| `import` (set at insert, not from model prose). |
| `flags` | Optional JSON: `estimated`, `suspect`, `verified`. |

### Shared Zod: inserts

[`shared/schema/transaction.ts`](shared/schema/transaction.ts):

- **`securityTransactionOrphanInsertSchema`** — fields without `assetSecurityId`: `value` and `currencyValue` use `decimalValueSchemaRequiredGreaterThanZero`; optional `fees`, `currency`, `valueDate`, `recordedAt`, `source`, `flags`.
- **`securityTransactionInsertSchema`** — extends with required `assetSecurityId`.

Any OCR pipeline that aims at **persisted security transactions** should produce data that can validate against the **orphan** schema (plus separate resolution to `assetSecurityId`), or an explicit **candidate** schema that maps 1:1 to those fields after normalisation.

### Gap (what extraction must add)

At minimum, per **line or holding** on the document:

1. **Security identity** (for resolution): ISIN, ticker/symbol, and/or name + confidence (and optionally platform hints already in hand).
2. **`value`** — share quantity as a decimal string compatible with `decimalValueSchema` / branded decimal rules.
3. **`currencyValue`** — cash value in statement currency.
4. **`valueDate`** (and **`recordedAt`** if the document distinguishes them).
5. Optional **`fees`**, **`currency`** if visible.
6. Optional **evidence** (snippet from transcript) for a future verification step and for `flags.suspect` / human review.

The LLM should **not** emit `assetSecurityId` unless you add an unsafe auto-match; prefer **candidate + UI/service resolution** → then `securityTransactionInsertSchema`.

### Product / API implication

The Record flow today expects **`{ assetId, value }[]`** for **asset** values. Security-transaction capture is a **different** outcome:

- Either introduce an **extraction mode** (e.g. asset snapshot vs security holdings) on upload/route, **or**
- Separate endpoint / process key / client flow for “statement → security transaction candidates”.

Document that choice explicitly before implementing schema swaps on the existing `document-ocr-completed` payload.

### Email-origin input → OCR processing path

Users may **forward** broker or platform emails into the product (e.g. “Your portfolio has been updated”) instead of uploading in the UI. **How those messages reach the app** (webhook, polling, provider-specific ingress, etc.) is **not decided yet**—this plan does **not** prescribe **HTTP routes** or any concrete receipt implementation.

What **is** in scope for product/architecture planning:

- Treat **email-sourced** content as a **second input channel** alongside the existing multipart upload.
- After whatever ingestion layer exists, processing should **converge** on the same primitives as today: **first-class `documents`** (e.g. from attachments or normalised body) and the existing **`document-ocr`** / `startDocumentOcr` style async flow (`platformKey`, queue, WebSocket), so behaviour stays consistent.
- Implementers will need a **clear server-side processing entry** for “email batch → resolved `userAccountId` → buffers/metadata → `DocumentService` + OCR orchestration” (exact API shape **TBD**—could be a **service function** invoked by a future worker, not HTTP).

**Later decisions (outside this plan until ingestion is chosen):** transport auth, envelope → `userAccountId` mapping, MIME vs provider payloads, idempotency (e.g. Message-Id), limits, scanning, and HTML body vs attachment policy.

This is **additive** to manual upload; both channels target **documents + async OCR**.

---

## Text-first and multi-step LLM (quality)

Same approach as discussed: **native PDF text** when sufficient → **text-only** LLM interpretation; **vision fallback** when text is sparse; optional **verify** pass; later **raster OCR** for scanned PDFs.

```mermaid
flowchart TD
  B[buffer + mimeType]
  B --> PDF{PDF?}
  PDF -->|yes| Native[Native PDF text]
  Native --> Sparse{Sufficient text?}
  Sparse -->|yes| T1[LLM from transcript]
  Sparse -->|no| V[Vision path]
  PDF -->|no| V
  V --> T1
  T1 --> T2[Optional verify]
```

Implementation phases (unchanged in spirit):

1. PDF text module + heuristic + **`--dump-text`**. **Done:** [`server/services/pdf-text/`](../../server/services/pdf-text/) + env-configurable thresholds; **`npm run test:ocr -- <file.pdf> --dump-text`** (see todo `ocr-cli-dump-text`).
2. Split `OcrService`: transcript vs vision; shared `prepareOcrDocumentUserContentBase`. **Done:** `document-user-content.ts` + `extract` / `extractFromPrepared`.
3. Logging (`path=text|vision`, `charCount`). **Done:** document-ocr handler completion log; `document-ocr-completed.pipeline`; dev `test-ocr --verbose` for LLM / 4c traces.
4. Optional second LLM pass for groundedness.
5. Optional OCR vendor/Tesseract when text layer empty.

---

## Multi-agent / routing: library evaluation

If the pipeline grows beyond **2–3 explicit steps** (route → extract → verify), a small **orchestration** layer or **graph** library can reduce ad-hoc branching. The stack already uses **`@anthropic-ai/sdk`** directly and **Express**; anything added should justify **bundle size**, **operational complexity**, and **debuggability** in your environment.

### Requirements: provider flexibility and future AI surfaces

These constraints should drive the spike and any long-term abstraction—not only OCR.

1. **Swappable and multiple LLMs** — Ability to **switch providers** (e.g. Anthropic, OpenAI, others) without rewriting every call site; support **different models per use case** (cheap router vs strong reasoner, vision vs text-only, etc.).
2. **Local / self-hosted** — Path to **Ollama** (or similar) for dev, cost control, or privacy-sensitive flows; same calling pattern as cloud where feasible (capability flags when local models lack vision/PDF).
3. **Versatility beyond OCR** — Document upload extraction is the **first** AI use; anticipate **other domains** (e.g. AI-assisted **search**, summarisation, classification, future “reals” or product-specific assistants). The chosen direction should **not** be a one-off OCR wrapper but a **shared server-side pattern** for “call model X with structured in/out”.

Implication: evaluate both **orchestration** (graphs, routing) and **provider abstraction** (unified client or gateway). Options include a **thin internal module** (`LlmGateway` / `complete({ modelRef, messages })`) implemented with vendor SDKs behind an interface, or a **library** that already normalises providers (often with tradeoffs for vision/PDF and streaming).

### Options to compare (Spike 2 and beyond; Spike 1 stays plain TS—see **Ordered spikes** below)

| Direction | Role | Fit for this project |
|-----------|------|----------------------|
| **Plain TypeScript + internal gateway** | Hand-written `LlmClient` interface; per-provider adapters (Anthropic, OpenAI, Ollama HTTP); orchestration stays explicit functions or a tiny state machine. | **Maximum control** for multi-provider + Ollama; **no** graph UX—more code for branching/checkpoints. Best baseline to compare others against. |
| **LangGraph** (JS/TS) | Stateful graphs, branching, human-in-the-loop hooks; often paired with LangChain primitives. | Strong for **named steps** and **conditional routing**; provider story usually via **LangChain chat models** (check Anthropic vision/PDF + **Ollama** coverage in the versions you pin). |
| **LangChain.js** | Chains, Runnables, many **integrations** (cloud + local). | Broad **provider** surface; risk of **large dependency graph**; validate tree size and ESM/Node 24. |
| **Vercel AI SDK** | `generateText` / `streamText`, **multiple providers**, React streaming; community patterns for non-Next server usage. | Good **multi-provider** story; confirm **Express/long-running workers**, **vision/PDF** paths, and **Ollama** support match your OCR and future search flows. |
| **Mastra** | Workflows/agents in TS (newer ecosystem). | Assess **provider list**, stability, and fit with your commit/deps rules. |
| **Workflow engines** (Inngest, Temporal, etc.) | Durable steps, retries—**not** LLM-specific. | Orthogonal: use for **job durability** while keeping LLM calls behind a gateway; does not replace provider abstraction. |

### Selection criteria (use in the spike doc)

1. **Multi-provider and per-use-case models** — Configure **model id / provider** per feature (OCR extract vs verify vs future search) without duplicating HTTP glue everywhere.
2. **Local LLM path** — Ollama (or chosen runtime) callable with the **same abstraction** where capabilities align; explicit **degradation** when local model cannot do PDF/vision (fallback to cloud or text-only transcript path).
3. **Future features** — Same layer usable for **non-OCR** AI (search, classification, etc.) with consistent logging, timeouts, and optional streaming.
4. **Anthropic / vision / PDF today** — OCR must not regress: document + image content must remain expressible (either through the library’s multimodal API or by keeping a **narrow escape hatch** to `@anthropic-ai/sdk` until unified).
5. **Type safety** — Step boundaries align with **Zod** (`shared/schema`).
6. **State and durability** — Align with **`processes`** (and future **`ocr_jobs`**); distinguish **in-memory graph state** from **persisted job state**.
7. **Team cost** — Debuggability in production vs plain functions.
8. **Dependencies** — Match [package.json](package.json) discipline; avoid a heavy tree for a single feature.

### Gateway and orchestration status

**Spike 1 is complete** — [`server/services/llm/`](../../server/services/llm/) (`LlmGateway`, `AnthropicLlmGateway`, `createDefaultAnthropicLlmGateway`) is the foundation; explicit TS orchestration in `runFullDocumentOcrPipeline` mirrors the flow diagram. This is sufficient for the current product pipeline.

**Spike 1 exit (second provider)** and **Spike 2 (LangGraph)** are **deferred** until the product pipeline (dual-track payload → resolution → persistence → client review) is end-to-end stable. Rationale: the plain TS gateway is enough for proof of concept; adding a second provider or a graph library before the product flow is working adds complexity without product value right now.

When revisiting: the gateway contract (`createNonStreamingMessage`) is designed to accept a second adapter without touching call sites; LangGraph (if evaluated) would sit **above** the gateway, not replace it.

---

## Open implementation decisions (by phase)

These are the **decision points** called out when starting Spike 1. Each row states **when** the decision must be taken so work stays sequenced and reviewable.

| Decision | Notes | Must be resolved by |
|----------|--------|----------------------|
| **Gateway v1 contract** | First `LlmGateway` implementation: `createNonStreamingMessage` accepts Anthropic **`MessageCreateParamsNonStreaming`** today; **`LlmModelRef`** / `LlmProviderId` in [`server/services/llm/llm-gateway.ts`](../../server/services/llm/llm-gateway.ts) are reserved for routing when Bedrock / Ollama adapters land. | **Spike 1 — gateway scaffolding** (land baseline; adjust signatures only when adding the second adapter if needed). |
| **Native PDF text vs transcript-first slice** | **Resolved (Spike 1):** For `application/pdf`, [`server/services/pdf-text/`](../../server/services/pdf-text/) runs **in-process** in the same worker as `OcrService` (not a separate service). **All pages** extracted via **`unpdf`**; **password-protected** PDFs throw `PdfPasswordProtectedError`. If native text is **sufficient** (`OCR_PDF_TEXT_MIN_CHARS`, `OCR_PDF_TEXT_MIN_WORDS`), `OcrService` uses **transcript-only** LLM messages; otherwise **Anthropic PDF document** vision path. **Non-PDF** skips PDF extraction. | — |
| **`platformKey` / OCR config shape** | How `POST …/extract` and `processes` carry platform identity (`unknown`, slug, **`broker_platforms.id` UUID**, etc.) so **3c** can compare apples-to-apples with DB rows. | **First implementation** that runs **3b/3c** brand verification against **`broker_platforms`** (before persisting or enforcing config alignment in prod). |
| **Where orchestration runs** | Same Node process as **`document-ocr-distributed-handler`** vs separate worker / future durable engine (Temporal, Inngest). | **Default: in-process** (existing handler path). Revisit only if durable steps are needed — deferred past `client-candidate-review`. |
| **Second provider priority** | First non-Anthropic adapter: **Ollama (text)** vs **AWS Bedrock** vs other. | **Deferred** — revisit after product pipeline is end-to-end (`orchestration-spike-1-exit-provider`). |
| **Dual-track OCR payloads** | Record **asset-value** OCR vs **security-transaction** OCR: modes, routes, WebSocket / queue payloads, coexistence with `ExtractedAmount[]`. | **`product-dual-track` todo** before **`ExtractedAmount`-only** is removed as the sole production contract. |

---

## Suggested implementation order

The gateway foundation (Spike 1) is complete. Product features are the priority; a second provider and LangGraph evaluation (`orchestration-spike-1-exit-provider`, `orchestration-spike-2-langgraph`) are deferred until the pipeline is end-to-end stable.

1. **Dual-track payload** (`product-dual-track`) — Decide how `securityHoldings` candidates flow through `document-ocr-completed` and the WebSocket to the client; may coexist with `ExtractedAmount[]` for Record-only flows temporarily.
2. **Resolution service** (`candidate-resolution`) — Map verified candidate `{ symbol, isin, name }` + `userAccountId` → `assetSecurityId` (securities cache, fuzzy name, ISIN lookup); separate from `OcrService`.
3. **Persistence** (`candidate-persistence`) — Insert resolved candidates as `security_transactions` with `source: "ocr"` after 4c + resolution.
4. **Client candidate review** (`client-candidate-review`) — UI to surface candidates, confirm/reject rows, handle unresolved (new security not in portfolio).
5. **Phase 2 verify** (`phase2-verify`) — Optional groundedness/suspect-row pass; feature-flagged, additive.
6. **Email-origin OCR path** (`email-origin-ocr-path`) — Server-side processing entry once ingestion transport is decided; no HTTP email receipt in this plan until then.
7. **Second provider + LangGraph** (`orchestration-spike-1-exit-provider`, `orchestration-spike-2-langgraph`) — Deferred; revisit when the above is stable and provider flexibility is needed.

---

## Documentation

- Keep [DocumentUpload OCR Refactor](documentupload_ocr_refactor_1e50c3b2.plan.md) in sync: add a one-line pointer that extraction payloads will evolve toward security-transaction candidates per this plan.
- Keep [`docs/Transaction-OCR-flow.md`](../../docs/Transaction-OCR-flow.md) as the **living** end-to-end pipeline diagram (mermaid); this plan’s phases should stay aligned with that document when steps change.
- Keep **Open implementation decisions (by phase)** (above) updated when a row is decided or deferred.
