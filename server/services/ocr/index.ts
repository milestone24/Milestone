import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MESSAGES_MODEL } from "@server/constants/anthropic-messages-model";
import {
  createDefaultAnthropicLlmGateway,
  type LlmGateway,
} from "@server/services/llm";
import { log } from "@server/log";
import { extractedAmountSchema, type ExtractedAmount } from "@shared/schema/document";
import { z } from "zod";

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

type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

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

  constructor(llm: LlmGateway = createDefaultAnthropicLlmGateway()) {
    this.llm = llm;
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
    platformNames: string[]
  ): Promise<ExtractedAmount[]> {
    const base64 = buffer.toString("base64");
    const platformsString = platformNames.join(", ");

    const systemPrompt = this.buildSystemPrompt(platformKey, platformsString);

    const contentBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam =
      mimeType === "application/pdf"
        ? {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as SupportedImageType,
              data: base64,
            },
          };

    const response = await this.llm.createNonStreamingMessage({
      model: ANTHROPIC_MESSAGES_MODEL,
      max_tokens: 2048,
      system: `${systemPrompt}${JSON_ONLY_SUFFIX}`,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: `Extract all account balances from this document.

Return ONLY a single JSON array of objects with keys: platformName (string), amount (number), confidence (number 0-1), optional accountType (string).
Example: [{"platformName":"Example Broker","amount":12345.67,"confidence":0.9,"accountType":"ISA"}]
If none: []`,
            },
          ],
        },
      ],
    });

    const replyText = collectTextFromMessageContent(response.content);
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
