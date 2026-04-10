---
name: OCR text-first pipeline and capture schema
overview: Improve extraction quality via native PDF text + multi-step LLM, evolve capture types for security_transactions (DB + shared Zod), reserve a processing path for email-origin OCR input (how email is received—not yet decided), and run two ordered orchestration spikes—first plain TypeScript + thin LLM gateway, then time-boxed LangGraph—for provider-agnostic access (Ollama, AWS Bedrock, etc.) without debugging graph and PDF/vision at once.
todos:
  - id: schema-gap-analysis
    content: Define shared Zod for OCR security-transaction candidates vs securityTransactionOrphanInsertSchema; document resolution path to assetSecurityId
    status: completed
  - id: pdf-text-module
    content: Add PDF native text extraction + isTextSufficient heuristic; choose library after ESM compatibility check
    status: pending
  - id: ocr-service-split
    content: Refactor OcrService — extractFromTranscript, extractFromVision, extract orchestration
    status: pending
  - id: pipeline-wire-logging
    content: Handler + structured logs (path=text|vision, charCount); optional CLI --dump-text
    status: pending
  - id: product-dual-track
    content: Clarify Record asset-values OCR vs security-transaction OCR (mode, routes, or separate flows)
    status: pending
  - id: phase2-verify
    content: Optional groundedness verify pass + feature flag
    status: pending
  - id: orchestration-spike-1-ts-gateway
    content: Spike 1 — thin LlmGateway + explicit TS orchestration for OCR phases (aligned with docs/Transaction-OCR-flow.md); no LangGraph until PDF text + OcrService transcript/vision split is stable; validate structured I/O with existing Zod
    status: pending
  - id: orchestration-spike-2-langgraph
    content: Spike 2 — time-boxed LangGraph (+ LangChain chat models) on one vertical slice; evaluate Ollama + AWS Bedrock (or other) via same gateway pattern; record decision vs staying on plain TS
    status: pending
  - id: phase3-raster-ocr
    content: Optional Tesseract/managed OCR when PDF text layer insufficient
    status: pending
  - id: email-origin-ocr-path
    content: Define server-side processing entry for email-sourced statements (normalised to documents + same document-ocr flow); do not implement email receipt (HTTP vs provider vs other) until ingestion is decided
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

1. PDF text module + heuristic + CLI `--dump-text`.
2. Split `OcrService`: transcript vs vision; orchestration in `extract`.
3. Logging (`path=text|vision`, `charCount`).
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

### Ordered spikes (agreed)

1. **Spike 1 — Plain TypeScript + thin `LlmGateway` (first)**  
   - **Goal:** Establish a **diversifiable foundation** before adding a graph library: one internal contract (`modelRef`, messages in, **Zod-validated** structured data out, timeouts, logging) with **per-provider adapters** (Anthropic SDK today; **Ollama** HTTP and **AWS Bedrock** later behind the same interface). **Baseline code:** [`server/services/llm/`](../../server/services/llm/) (`LlmGateway`, `AnthropicLlmGateway`, `createDefaultAnthropicLlmGateway`) with **`OcrService`** calling the gateway for `messages.create`.  
   - **Orchestration:** **Explicit** functions or a tiny hand-rolled state machine that mirror [`docs/Transaction-OCR-flow.md`](../../docs/Transaction-OCR-flow.md) (document ready → prep → Phase 1 LLM → code verifiers → Phase 2 LLM → …). **No LangGraph** in this spike so we do not couple **PDF text extraction**, **transcript vs vision split**, and **graph debugging**.  
   - **Exit criteria (example):** One vertical slice (e.g. transcript → `statementPlatformBrandIdentificationSchema` or security row schema) runs through gateway + verifiers; second provider (e.g. Ollama **text**) proves **swap cost** is acceptable.

2. **Spike 2 — LangGraph (time-boxed, after Spike 1 is stable)**  
   - **Goal:** Decide whether **LangGraph** (+ **LangChain.js** chat models) earns its **dependency weight** for named nodes, conditional edges, and future checkpoints—while **reusing** the same **gateway** for Bedrock / Ollama / Anthropic. LangGraph does **not** replace the gateway; it sits **above** it.  
   - **Scope:** Re-implement **one** slice of the same pipeline as a small graph; compare **debuggability** and **boilerplate** vs Spike 1.  
   - **Exit criteria:** Written decision: adopt LangGraph for OCR orchestration, defer, or use only for a subset; note **non-goals** and **model tier** per feature (extract vs verify vs future search).

### Recommendation in the plan (summary)

- **PDF text + split `OcrService`** remains the **first implementation priority** alongside Spike 1 gateway work where they touch the same code paths.  
- **Do not** introduce LangGraph until **Spike 1** exit criteria are met (text path + explicit orchestration stable enough that graph issues are isolatable).  
- **Document the outcome** of both spikes in this plan (or a short note): chosen **gateway + optional LangGraph**, explicit **non-goals**, and which routes use **which provider** (including Bedrock when adopted).

---

## Open implementation decisions (by phase)

These are the **decision points** called out when starting Spike 1. Each row states **when** the decision must be taken so work stays sequenced and reviewable.

| Decision | Notes | Must be resolved by |
|----------|--------|----------------------|
| **Gateway v1 contract** | First `LlmGateway` implementation: `createNonStreamingMessage` accepts Anthropic **`MessageCreateParamsNonStreaming`** today; **`LlmModelRef`** / `LlmProviderId` in [`server/services/llm/llm-gateway.ts`](../../server/services/llm/llm-gateway.ts) are reserved for routing when Bedrock / Ollama adapters land. | **Spike 1 — gateway scaffolding** (land baseline; adjust signatures only when adding the second adapter if needed). |
| **Native PDF text vs transcript-first slice** | Whether all paths wait on **native PDF text + `isTextSufficient`** before any LLM call, or a **transcript-only / bytes-only** slice ships first and PDF text follows. | Completion of **`pdf-text-module`** + **`ocr-service-split`** todos — **document the chosen order** in this plan when those tasks close. |
| **`platformKey` / OCR config shape** | How `POST …/extract` and `processes` carry platform identity (`unknown`, slug, **`broker_platforms.id` UUID**, etc.) so **3c** can compare apples-to-apples with DB rows. | **First implementation** that runs **3b/3c** brand verification against **`broker_platforms`** (before persisting or enforcing config alignment in prod). |
| **Where orchestration runs** | Same Node process as **`document-ocr-distributed-handler`** vs separate worker / future durable engine (Temporal, Inngest). | **Before Spike 2 (LangGraph)** if checkpoints or long-running state need a host; **default** for Spike 1: **in-process** in the existing handler path unless product says otherwise. |
| **Second provider priority** | First non-Anthropic adapter after gateway: **Ollama (text)** vs **AWS Bedrock** vs other — driven by dev cost, AWS alignment, and structured-output quality on a vertical slice. | **`orchestration-spike-1-ts-gateway` exit** (or explicit hand-off note when starting **`orchestration-spike-2-langgraph`**). |
| **Dual-track OCR payloads** | Record **asset-value** OCR vs **security-transaction** OCR: modes, routes, WebSocket / queue payloads, coexistence with `ExtractedAmount[]`. | **`product-dual-track` todo** before **`ExtractedAmount`-only** is removed as the sole production contract. |

---

## Suggested implementation order

0. **Orchestration spikes (ordered)** — Follow **Ordered spikes (agreed)** above and the diagram in [`docs/Transaction-OCR-flow.md`](../../docs/Transaction-OCR-flow.md) § **Implementation evolution**; Spike 1 before LangGraph (Spike 2).

1. **Schema & contract** — Add `extractedSecurityTransactionCandidateSchema` (or equivalent) in `shared/schema`, aligned with orphan insert fields + security identity fields; update queue/WebSocket types and handler to emit candidates (may coexist temporarily with `ExtractedAmount` for Record-only flows).
2. **PDF text + LLM split** — As above; prompt JSON must match the new schema.
3. **Resolution service** (separate from `OcrService`) — Map candidate + `userAccountId` → `assetSecurityId` (securities cache, fuzzy name, ISIN lookup); out of scope for pure “OcrService” module.
4. **Client** — Review UI for candidates, mapping to holdings, confirm before insert.
5. **Email-origin OCR path** — Processing entry and normalisation to documents + `document-ocr` once ingestion is decided; **no** HTTP email receipt in this plan until receipt design is agreed.

---

## Documentation

- Keep [DocumentUpload OCR Refactor](documentupload_ocr_refactor_1e50c3b2.plan.md) in sync: add a one-line pointer that extraction payloads will evolve toward security-transaction candidates per this plan.
- Keep [`docs/Transaction-OCR-flow.md`](../../docs/Transaction-OCR-flow.md) as the **living** end-to-end pipeline diagram (mermaid); this plan’s phases should stay aligned with that document when steps change.
- Keep **Open implementation decisions (by phase)** (above) updated when a row is decided or deferred.
