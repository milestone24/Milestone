import type Anthropic from "@anthropic-ai/sdk";
import {
  analyzeDocumentForOcrTranscript,
  type DocumentTranscriptAnalysis,
  type PdfTextExtractionConfig,
} from "@server/services/pdf-text";
import { log } from "@server/log";

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];
export type SupportedOcrDocumentMimeType =
  | SupportedImageMimeType
  | "application/pdf";

export type OcrDocumentLlmPath = "text" | "vision";

export type PreparedOcrDocumentUserContent = {
  /** Blocks to place before the per-phase instruction text block. */
  baseUserContent: Anthropic.ContentBlockParam[];
  meta: {
    path: OcrDocumentLlmPath;
    charCount?: number;
    wordCount?: number;
    totalPages?: number;
  };
};

function buildVisionImageBase(
  mimeType: SupportedImageMimeType,
  base64: string
): PreparedOcrDocumentUserContent {
  log(`OcrService: extractionPath=vision mimeType=${mimeType} (image)`);
  const imageBlock: Anthropic.ImageBlockParam = {
    type: "image",
    source: {
      type: "base64",
      media_type: mimeType,
      data: base64,
    },
  };
  return {
    baseUserContent: [imageBlock],
    meta: { path: "vision" },
  };
}

function buildTranscriptPdfBase(
  analysis: Extract<DocumentTranscriptAnalysis, { kind: "pdf_transcript" }>
): PreparedOcrDocumentUserContent {
  log("OcrService: extractionPath=transcript (native PDF text)");
  return {
    baseUserContent: [
      {
        type: "text",
        text: `Below is the full plain text extracted from all ${analysis.totalPages} PDF page(s). Use only this transcript (no PDF image is attached).`,
      },
      { type: "text", text: analysis.fullTranscript },
    ],
    meta: {
      path: "text",
      charCount: analysis.charCount,
      wordCount: analysis.wordCount,
      totalPages: analysis.totalPages,
    },
  };
}

function buildVisionPdfBase(base64: string): PreparedOcrDocumentUserContent {
  log(
    "OcrService: extractionPath=vision (Anthropic PDF document — sparse native text)"
  );
  const documentBlock: Anthropic.DocumentBlockParam = {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: base64,
    },
  };
  return {
    baseUserContent: [documentBlock],
    meta: { path: "vision" },
  };
}

/**
 * Builds shared multimodal user content for OCR LLM phases (brand, securities, balances).
 * Call once per document, then append a phase-specific trailing `text` block per request.
 */
export async function prepareOcrDocumentUserContentBase(
  buffer: Buffer,
  mimeType: SupportedOcrDocumentMimeType,
  pdfTextConfig: PdfTextExtractionConfig,
  abortSignal?: AbortSignal
): Promise<PreparedOcrDocumentUserContent> {
  abortSignal?.throwIfAborted();

  const base64 = buffer.toString("base64");

  if (mimeType !== "application/pdf") {
    return buildVisionImageBase(mimeType, base64);
  }

  abortSignal?.throwIfAborted();

  const analysis = await analyzeDocumentForOcrTranscript(
    buffer,
    mimeType,
    pdfTextConfig,
    { abortSignal }
  );

  if (analysis.kind !== "pdf_transcript") {
    throw new Error(
      `prepareOcrDocumentUserContentBase: expected pdf_transcript for application/pdf`
    );
  }

  log(
    `OcrService: pdf native text pages=${analysis.totalPages} chars=${analysis.charCount} words=${analysis.wordCount} transcriptPath=${analysis.useTranscriptPath}`
  );

  if (analysis.useTranscriptPath) {
    return buildTranscriptPdfBase(analysis);
  }

  return buildVisionPdfBase(base64);
}

export function appendPhaseInstruction(
  base: Anthropic.ContentBlockParam[],
  instruction: string
): Anthropic.ContentBlockParam[] {
  return [...base, { type: "text", text: instruction }];
}
