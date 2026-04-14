import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MESSAGES_MODEL } from "@server/constants/anthropic-messages-model";
import {
  createDefaultAnthropicLlmGateway,
  createNonStreamingMessageWithAbort,
  type LlmGateway,
} from "@server/services/llm";
import { loadPdfTextExtractionConfigFromEnv, type PdfTextExtractionConfig } from "@server/services/pdf-text";
import { log } from "@server/log";
import { extractedAmountSchema, type ExtractedAmount } from "@shared/schema/document";
import { z } from "zod";
import {
  appendPhaseInstruction,
  prepareOcrDocumentUserContentBase,
  type PreparedOcrDocumentUserContent,
} from "./document-user-content";
import type { OcrPipelineVerboseLog } from "./transaction-ocr-orchestrator";

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

const SUPPORTED_MIME_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  "application/pdf",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

const JSON_ONLY_SUFFIX = `
Output rules (strict):
- Respond with ONLY a JSON array. No sentences, no preamble, no "Here is", no markdown code fences.
- Start your reply with "[" and end with "]".
- Use [] if there are no balances.`;

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

/**
 * Parses model output that may include markdown fences or leading prose.
 */
function stripMarkdownCodeFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m?.[1]) return m[1].trim();
  return s.trim();
}

function parseExtractedAmountsFromModelText(raw: string): ExtractedAmount[] | null {
  let s = stripMarkdownCodeFence(raw.trim());

  const tryValidate = (parsed: unknown): ExtractedAmount[] | null => {
    const validated = z.array(extractedAmountSchema).safeParse(parsed);
    return validated.success ? validated.data : null;
  };

  try {
    const direct = JSON.parse(s);
    const ok = tryValidate(direct);
    if (ok) return ok;
  } catch {
    // fall through
  }

  const start = s.indexOf("[");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        try {
          const slice = s.slice(start, i + 1);
          const parsed = JSON.parse(slice);
          return tryValidate(parsed);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

export class OcrService {
  private readonly llm: LlmGateway;
  private readonly pdfTextConfig: PdfTextExtractionConfig;

  constructor(
    llm: LlmGateway = createDefaultAnthropicLlmGateway(),
    pdfTextConfig: PdfTextExtractionConfig = loadPdfTextExtractionConfigFromEnv()
  ) {
    this.llm = llm;
    this.pdfTextConfig = pdfTextConfig;
  }

  /**
   * Extracts financial account values from a document buffer.
   * Supports images (jpeg, png, gif, webp) and PDFs.
   * The caller is responsible for ensuring the mimeType is supported
   * before calling this method — use isSupportedMimeType() to check.
   *
   * Unknown platform path (platformKey === "unknown") is TBC.
   */
  async extract(
    buffer: Buffer,
    mimeType: SupportedMimeType,
    platformKey: string,
    platformNames: string[],
    options?: { verboseLog?: OcrPipelineVerboseLog }
  ): Promise<ExtractedAmount[]> {
    const prepared = await prepareOcrDocumentUserContentBase(
      buffer,
      mimeType,
      this.pdfTextConfig
    );
    return this.extractFromPrepared(
      prepared,
      platformKey,
      platformNames,
      options
    );
  }

  /**
   * Balance extraction using document blocks from {@link prepareOcrDocumentUserContentBase}
   * (avoids re-running PDF native text extraction when the orchestrator already prepared the document).
   */
  async extractFromPrepared(
    prepared: PreparedOcrDocumentUserContent,
    platformKey: string,
    platformNames: string[],
    options?: { verboseLog?: OcrPipelineVerboseLog; abortSignal?: AbortSignal }
  ): Promise<ExtractedAmount[]> {
    const v = options?.verboseLog;
    const signal = options?.abortSignal;
    const platformsString = platformNames.join(", ");

    const systemPrompt = this.buildSystemPrompt(platformKey, platformsString);

    const extractionInstruction = `Extract all account balances from this document.

Return ONLY a single JSON array of objects with keys: platformName (string), amount (number), confidence (number 0-1), optional accountType (string).
Example: [{"platformName":"Example Broker","amount":12345.67,"confidence":0.9,"accountType":"ISA"}]
If none: []`;

    const userContent = appendPhaseInstruction(
      prepared.baseUserContent,
      extractionInstruction
    );

    v?.("balances_llm_request", {
      maxTokens: 2048,
      userContentBlockCount: userContent.length,
      platformKey,
    });

    signal?.throwIfAborted();

    const t0 = Date.now();
    const response = await createNonStreamingMessageWithAbort(
      this.llm,
      {
        model: ANTHROPIC_MESSAGES_MODEL,
        max_tokens: 2048,
        system: `${systemPrompt}${JSON_ONLY_SUFFIX}`,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      },
      signal
    );

    const replyText = collectTextFromMessageContent(response.content);
    const rawMax = 80_000;
    const rawLogged =
      replyText.length <= rawMax
        ? replyText
        : `${replyText.slice(0, rawMax)}\n... [truncated, ${String(replyText.length)} total chars]`;
    v?.("balances_llm_response", {
      elapsedMs: Date.now() - t0,
      charCount: replyText.length,
      rawText: rawLogged,
    });

    if (!replyText.trim()) {
      log("OcrService: empty text content from Anthropic");
      return [];
    }

    const results = parseExtractedAmountsFromModelText(replyText);
    if (results === null) {
      log(
        `OcrService: could not parse JSON array from model reply (prefix=${JSON.stringify(replyText.slice(0, 80))})`
      );
      return [];
    }

    v?.("balances_parsed", { count: results.length, results });

    return results;
  }

  private buildSystemPrompt(platformKey: string, platformsString: string): string {
    if (platformKey === "unknown") {
      // TBC: platform identification prompt
      return `You are a financial assistant that extracts account balances from financial documents.
Identify the broker platform and extract all account balances you can find.
Each object must be: { "platformName": string, "amount": number, "confidence": number between 0 and 1, "accountType": string optional }.
If you cannot identify any balances, return [].`;
    }

    return `You are a financial assistant that extracts account balances from financial documents.
Extract account balances for the following platform: ${platformsString}.
Each object must be: { "platformName": string, "amount": number, "confidence": number between 0 and 1, "accountType": string optional }.
Only include accounts where you can clearly read a balance value.
If you cannot identify any balances, return [].`;
  }
}

export {
  runFullDocumentOcrPipeline,
  type FullDocumentOcrResult,
  type OcrPipelineVerboseLog,
} from "./transaction-ocr-orchestrator";
