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
  parseConfiguredBrokerPlatformId,
  verifySecurityHoldingsOwnedByUser,
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

/**
 * Runs Phase 3a–3c (brand) and Phase 4a–4c (securities), then balance extraction via {@link extractBalances}.
 * PDF native text vs vision is decided once; all LLM phases reuse the same document blocks.
 */
export async function runFullDocumentOcrPipeline(params: {
  buffer: Buffer;
  mimeType: SupportedOcrDocumentMimeType;
  platformKey: string;
  platformNames: string[];
  accountId: string;
  extractBalances: (
    prepared: PreparedOcrDocumentUserContent
  ) => Promise<ExtractedAmount[]>;
  llm?: LlmGateway;
}): Promise<FullDocumentOcrResult> {
  const llm = params.llm ?? createDefaultAnthropicLlmGateway();
  const pdfTextConfig = loadPdfTextExtractionConfigFromEnv();

  const prepared = await prepareOcrDocumentUserContentBase(
    params.buffer,
    params.mimeType,
    pdfTextConfig
  );

  const brandInstruction = `Task: inspect the attached document content and produce the JSON object described in the system message (key "candidates").`;

  const brandUserContent = appendPhaseInstruction(
    prepared.baseUserContent,
    brandInstruction
  );

  const brandResponse = await llm.createNonStreamingMessage({
    model: ANTHROPIC_MESSAGES_MODEL,
    max_tokens: 1024,
    system: PHASE_3A_SYSTEM + JSON_OBJECT_ONLY_SUFFIX,
    messages: [{ role: "user", content: brandUserContent }],
  });

  const brandText = collectTextFromMessageContent(brandResponse.content);
  if (!brandText.trim()) {
    throw new Error("OCR phase 3a: empty model response for brand identification");
  }

  const brandIdentification = parseJsonObjectWithSchema(
    brandText,
    statementPlatformBrandIdentificationSchema,
    "Phase 3a brand identification"
  );

  const configuredBrokerPlatformId = parseConfiguredBrokerPlatformId(
    params.platformKey
  );

  const brandDbMatch = await verifyStatementPlatformBrand({
    identification: brandIdentification,
    configuredBrokerPlatformId,
  });
  assertBrandVerificationPassed(brandDbMatch);

  const securitiesInstruction = `Task: inspect the same document content and produce the JSON array described in the system message.`;

  const securitiesUserContent = appendPhaseInstruction(
    prepared.baseUserContent,
    securitiesInstruction
  );

  const securitiesResponse = await llm.createNonStreamingMessage({
    model: ANTHROPIC_MESSAGES_MODEL,
    max_tokens: 4096,
    system: PHASE_4A_SYSTEM + JSON_ARRAY_ONLY_SUFFIX,
    messages: [{ role: "user", content: securitiesUserContent }],
  });

  const securitiesText = collectTextFromMessageContent(securitiesResponse.content);
  if (!securitiesText.trim()) {
    throw new Error("OCR phase 4a: empty model response for securities extraction");
  }

  const securityHoldings = parseJsonArrayWithSchema(
    securitiesText,
    securityTransactionOcrExtractionListSchema,
    "Phase 4a securities extraction"
  );

  await verifySecurityHoldingsOwnedByUser({
    accountId: params.accountId,
    rows: securityHoldings,
  });

  const pipeline: DocumentOcrPipelineResult = {
    brandIdentification,
    brandDbMatch,
    securityHoldings,
    llmPath: prepared.meta.path,
    nativePdfCharCount: prepared.meta.charCount,
  };

  const extractedValues = await params.extractBalances(prepared);

  return { pipeline, extractedValues };
}
