# Transaction OCR flow (living diagram)

This file holds the **authoritative mermaid** for transaction-related OCR. **Extend it here** as the pipeline evolves.

**Related plans:** [DocumentUpload OCR Refactor](../.cursor/plans/documentupload_ocr_refactor_1e50c3b2.plan.md) (upload → async job → WebSocket), [OCR text-first pipeline](../.cursor/plans/ocr_text-first_pipeline.plan.md) (PDF text-first, security-transaction capture, resolution, email-origin convergence).

## Model (how to read this)

- **Multiple AI runs** for **different jobs** (e.g. brand / platform vs securities evaluation)—each with its own **messages / agent role** and **structured purpose**, not one long undifferentiated chat.
- **Orchestration** (step 2) sets up that **multi-phase** flow (routing, tools, schemas, conversation state).
- **Verification** steps (**3b**, **3c**, **4b**, **4c**) are **not** the same as the LLM calls: DB checks, config vs DB alignment, Zod / schema gates, and **user portfolio** checks sit **between** or **after** AI phases as appropriate.

```mermaid
flowchart TD
  DR[1 Document ready]
  PREP[2 Prepare AI OCR orchestration]

  subgraph phase1["Phase 1 — platform / brand"]
    P1A[3a AI phase 1 — brand identification]
    P1B[3b Verify brand in DB]
    PK{3c Platform key in OCR config?}
    P1C[3c Verify DB match to configured platform — if not match exit failure]
  end

  subgraph phase2["Phase 2 — securities"]
    P2A[4a AI phase 2 — securities evaluation]
    P2B[4b Evaluate securities candidate rows vs satisfactory schemas]
    P2C[4c Verify securities candidates are owned by the user]
  end

  TBC[… To be continued]

  DR --> PREP
  PREP --> P1A
  P1A --> P1B
  P1B -->|fail| F[Exit failure]
  P1B -->|pass| PK
  PK -->|yes| P1C
  P1C -->|no match| F
  P1C -->|match| P2A
  PK -->|no| P2A
  P2A --> P2B
  P2B -->|unsatisfactory| F
  P2B -->|ok| P2C
  P2C --> TBC
```

**Legend**

- **1 → 2:** Nothing AI runs until there is a **document**; orchestration prepares **phases**, prompts, and outputs (e.g. LangChain-style graphs or explicit runners).
- **Phase 1:** **3a** is its own **model run**; **3b** is deterministic / service verification against **`platforms`** (or equivalent); **3c** runs **only when** a **platform key** was supplied for this OCR run—confirm the resolved row **matches** that config; otherwise **failure** (no silent mismatch).
- **Phase 2:** **4a** is a **second** model run (securities evaluation); **4b** is schema / shape validation on **candidate rows**; **4c** is **ownership** (candidates must map to securities the **user** actually holds—cache / DB, not model assertion alone).
- **TBC:** Further steps (persistence, UI confirm, more AI phases, etc.) go after **4c**.
