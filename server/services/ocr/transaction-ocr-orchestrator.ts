import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MESSAGES_MODEL } from "@server/constants/anthropic-messages-model";
import {
  createDefaultAnthropicLlmGateway,
  type LlmGateway,
} from "@server/services/llm";
import { loadPdfTextExtractionConfigFromEnv } from "@server/services/pdf-text";
import type { DocumentOcrPipelineResult, ExtractedAmount } from "@shared/schema/document";
import { statementPlatformBrandIdentificationSchema } from "@shared/schema/platform-brand-ocr";
import { securityTransactionOcrExtractionListSchema } from "@shared/schema/transaction";
import {
  appendPhaseInstruction,
  prepareOcrDocumentUserContentBase,
  type PreparedOcrDocumentUserContent,
  type SupportedOcrDocumentMimeType,
} from "./document-user-content";
import { parseJsonArrayWithSchema, parseJsonObjectWithSchema } from "./model-json";
import {
  assertBrandVerificationPassed,
  buildOcrAssetCandidateResults,
  parseConfiguredBrokerPlatformId,
  verifyStatementPlatformBrand,
} from "./transaction-ocr-verifiers";

const JSON_OBJECT_ONLY_SUFFIX = `
Output rules (strict):
- Respond with ONLY one JSON object. No markdown code fences, no preamble, no "Here is".
- Start your reply with "{" and end with "}".
`;

const JSON_ARRAY_ONLY_SUFFIX = `
Output rules (strict):
- Respond with ONLY a JSON array. No markdown code fences, no preamble.
- Start your reply with "[" and end with "]".
- Use [] if there are no qualifying rows.
`;

function collectTextFromMessageContent(
  content: Anthropic.Message["content"]
): string {
  if (typeof content === "string") return content;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && "text" in block) {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

const PHASE_3A_SYSTEM = `You are a financial document analyst. Your task is to identify which broker or platform issued this statement.

Return one JSON object with key "candidates" (array). Each candidate must have:
- name: string — the platform or broker name as shown on the document (or your best inference).
- confidence: number from 0 to 1.
- inferenceMethod: either "text" (from printed words) or "pixel" (from logos/layout/visual cues).
- evidenceSnippet: optional short quote from the document supporting the candidate.
- rank: optional integer; lower means stronger when you return multiple candidates (0 = best).

Include every plausible platform (at least one candidate). Order by strength if you use rank.`;

const PHASE_4A_SYSTEM = `You are a financial document analyst. Extract security / fund **holdings** rows from this statement (positions with share quantity and value), not cash account totals.

Return ONLY a JSON array. Each element must be one object with:
- value: string — share quantity as a decimal string (e.g. "12.5").
- currencyValue: string — monetary value in statement currency as a decimal string.
- valueDate: string — ISO 8601 date for the holding/snapshot.
- confidence: number from 0 to 1.
- name: string — security or fund name as printed.
- symbol: string — ticker or symbol if visible (otherwise infer from context only if clearly stated).
- isin: optional string — ISIN if visible.
- fees: optional string — decimal string if fees for this line are shown.
- currency: optional string — ISO currency code if not obvious from the statement.
- recordedAt: optional string — ISO date if distinct from valueDate.
- evidenceSnippet: optional short quote from the document.

Rules:
- Use decimal **strings** for all numeric amounts (value, currencyValue, fees) so precision is preserved.
- If there are no security holdings in the document, return [].
- Do not invent symbols or ISINs: omit optional fields when not readable.`;

export type FullDocumentOcrResult = {
  pipeline: DocumentOcrPipelineResult;
  extractedValues: ExtractedAmount[];
};

/** Optional stderr-style trace for CLI / debugging (timings, raw model text, verifier inputs). */
export type OcrPipelineVerboseLog = (
  step: string,
  detail?: Record<string, unknown>
) => void;

const VERBOSE_RAW_TEXT_MAX_CHARS = 80_000;

function truncateForVerbose(text: string, maxChars = VERBOSE_RAW_TEXT_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... [truncated, ${String(text.length)} total chars]`;
}

/**
 * Runs Phase 3a–3c (brand), Phase 4a–4b (securities extract + Zod), Phase 4c (asset-candidate tree),
 * then balance extraction via {@link extractBalances}.
 * PDF native text vs vision is decided once; all LLM phases reuse the same document blocks.
 */
export async function runFullDocumentOcrPipeline(params: {
  buffer: Buffer;
  mimeType: SupportedOcrDocumentMimeType;
  platformKey: string;
  platformNames: string[];
  accountId: string;
  /** Upload context: `user_assets.id` when OCR was started from an asset-scoped extract route. */
  nominatedUserAssetId?: string;
  extractBalances: (
    prepared: PreparedOcrDocumentUserContent
  ) => Promise<ExtractedAmount[]>;
  llm?: LlmGateway;
  /** When set, emits structured steps (e.g. raw 3a/4a model text, DB match before assert). */
  verboseLog?: OcrPipelineVerboseLog;
}): Promise<FullDocumentOcrResult> {
  const v = params.verboseLog;
  const llm = params.llm ?? createDefaultAnthropicLlmGateway();
  const pdfTextConfig = loadPdfTextExtractionConfigFromEnv();

  const tPrepare0 = Date.now();
  const prepared = await prepareOcrDocumentUserContentBase(
    params.buffer,
    params.mimeType,
    pdfTextConfig
  );
  v?.("document_prepared", {
    elapsedMs: Date.now() - tPrepare0,
    llmPath: prepared.meta.path,
    nativePdfCharCount: prepared.meta.charCount ?? null,
    wordCount: prepared.meta.wordCount ?? null,
    totalPages: prepared.meta.totalPages ?? null,
    model: ANTHROPIC_MESSAGES_MODEL,
  });

  const brandInstruction = `Task: inspect the attached document content and produce the JSON object described in the system message (key "candidates").`;

  const brandUserContent = appendPhaseInstruction(
    prepared.baseUserContent,
    brandInstruction
  );

  v?.("3a_llm_request", {
    phase: "brand_identification",
    maxTokens: 1024,
    userContentBlockCount: brandUserContent.length,
  });

  const t3a0 = Date.now();
  const brandResponse = await llm.createNonStreamingMessage({
    model: ANTHROPIC_MESSAGES_MODEL,
    max_tokens: 1024,
    system: PHASE_3A_SYSTEM + JSON_OBJECT_ONLY_SUFFIX,
    messages: [{ role: "user", content: brandUserContent }],
  });

  const brandText = collectTextFromMessageContent(brandResponse.content);
  v?.("3a_llm_response", {
    elapsedMs: Date.now() - t3a0,
    charCount: brandText.length,
    rawText: truncateForVerbose(brandText),
  });

  if (!brandText.trim()) {
    throw new Error("OCR phase 3a: empty model response for brand identification");
  }

  const brandIdentification = parseJsonObjectWithSchema(
    brandText,
    statementPlatformBrandIdentificationSchema,
    "Phase 3a brand identification"
  );

  v?.("3a_parsed", { brandIdentification });

  let configuredBrokerPlatformId: string | undefined;
  try {
    configuredBrokerPlatformId = parseConfiguredBrokerPlatformId(params.platformKey);
  } catch (e) {
    v?.("3c_platform_key_parse_error", {
      platformKey: params.platformKey,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }

  v?.("3b_3c_before_db_verify", {
    platformKey: params.platformKey,
    configuredBrokerPlatformId: configuredBrokerPlatformId ?? null,
  });

  const tVerify0 = Date.now();
  const brandDbMatch = await verifyStatementPlatformBrand({
    identification: brandIdentification,
    configuredBrokerPlatformId,
  });
  v?.("3b_3c_brand_db_match", {
    elapsedMs: Date.now() - tVerify0,
    brandDbMatch,
    ok: brandDbMatch.ok,
    hint:
      !brandDbMatch.ok && brandDbMatch.rejectReason === "config_platform_mismatch"
        ? "Document matched a different broker_platforms row than --platform UUID. Use --platform unknown or the UUID that matches the statement."
        : undefined,
  });

  assertBrandVerificationPassed(brandDbMatch);

  const securitiesInstruction = `Task: inspect the same document content and produce the JSON array described in the system message.`;

  const securitiesUserContent = appendPhaseInstruction(
    prepared.baseUserContent,
    securitiesInstruction
  );

  v?.("4a_llm_request", {
    phase: "securities_extraction",
    maxTokens: 4096,
    userContentBlockCount: securitiesUserContent.length,
  });

  const t4a0 = Date.now();
  const securitiesResponse = await llm.createNonStreamingMessage({
    model: ANTHROPIC_MESSAGES_MODEL,
    max_tokens: 4096,
    system: PHASE_4A_SYSTEM + JSON_ARRAY_ONLY_SUFFIX,
    messages: [{ role: "user", content: securitiesUserContent }],
  });

  const securitiesText = collectTextFromMessageContent(securitiesResponse.content);
  v?.("4a_llm_response", {
    elapsedMs: Date.now() - t4a0,
    charCount: securitiesText.length,
    rawText: truncateForVerbose(securitiesText),
  });

  if (!securitiesText.trim()) {
    throw new Error("OCR phase 4a: empty model response for securities extraction");
  }

  const securityHoldings = parseJsonArrayWithSchema(
    securitiesText,
    securityTransactionOcrExtractionListSchema,
    "Phase 4a securities extraction"
  );

  v?.("4a_parsed", { rowCount: securityHoldings.length });

  const t4c0 = Date.now();
  const assetCandidates = await buildOcrAssetCandidateResults({
    accountId: params.accountId,
    rows: securityHoldings,
    verboseLog: v,
  });
  v?.("4c_asset_candidates_done", {
    elapsedMs: Date.now() - t4c0,
    accountId: params.accountId,
    assetCandidateCount: assetCandidates.length,
  });

  const pipeline: DocumentOcrPipelineResult = {
    brandIdentification,
    brandDbMatch,
    securityHoldings,
    assetCandidates,
    nominatedUserAssetId: params.nominatedUserAssetId ?? null,
    llmPath: prepared.meta.path,
    nativePdfCharCount: prepared.meta.charCount,
  };

  const tBal0 = Date.now();
  const extractedValues = await params.extractBalances(prepared);
  v?.("balances_pipeline_step_done", {
    elapsedMs: Date.now() - tBal0,
    extractedCount: extractedValues.length,
    note: "includes balance LLM + parse (see balances_llm_* steps above)",
  });

  return { pipeline, extractedValues };
}
