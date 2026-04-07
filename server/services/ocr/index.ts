import Anthropic from "@anthropic-ai/sdk";
import { error, log } from "@server/log";
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class OcrService {
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

    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "Extract all account balances from this financial document. Return only a JSON array.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content[0];
    if (!textBlock || textBlock.type !== "text") {
      log("OcrService: unexpected response format from Anthropic");
      return [];
    }

    try {
      const parsed = JSON.parse(textBlock.text.trim());
      const validated = z.array(extractedAmountSchema).safeParse(parsed);
      if (!validated.success) {
        log("OcrService: response failed schema validation");
        return [];
      }
      return validated.data;
    } catch (parseError) {
      error(`OcrService: failed to parse Anthropic response: ${parseError}`);
      return [];
    }
  }

  private buildSystemPrompt(platformKey: string, platformsString: string): string {
    if (platformKey === "unknown") {
      // TBC: platform identification prompt
      return `You are a financial assistant that extracts account balances from financial documents.
Identify the broker platform and extract all account balances you can find.
Format your response as JSON only, as an array with this structure:
[{ "platformName": "Platform Name", "amount": 12345.67, "confidence": 0.95, "accountType": "ISA" }]
If you cannot identify any balances, return an empty array [].`;
    }

    return `You are a financial assistant that extracts account balances from financial documents.
Extract account balances for the following platform: ${platformsString}.
Format your response as JSON only, as an array with this structure:
[{ "platformName": "Platform Name", "amount": 12345.67, "confidence": 0.95, "accountType": "ISA" }]
Only include accounts where you can clearly read a balance value.
If you cannot identify any balances, return an empty array [].`;
  }
}
