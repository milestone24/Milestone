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

export type SupportedEmailBodyMimeType = "text/html" | "text/plain";

export type SupportedOcrDocumentMimeType =
  | SupportedImageMimeType
  | "application/pdf"
  | SupportedEmailBodyMimeType;

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

/** Cap email/HTML body size before sending to the multi-phase OCR LLM chain. */
const EMAIL_BODY_LLM_MAX_CHARS = 250_000;

function isSupportedEmailBodyMimeType(
  mimeType: SupportedOcrDocumentMimeType,
): mimeType is SupportedEmailBodyMimeType {
  return mimeType === "text/html" || mimeType === "text/plain";
}

function buildEmailBodyTextBase(
  buffer: Buffer,
  mimeType: SupportedEmailBodyMimeType,
): PreparedOcrDocumentUserContent {
  const decoded = buffer.toString("utf8");
  const truncated =
    decoded.length > EMAIL_BODY_LLM_MAX_CHARS
      ? `${decoded.slice(0, EMAIL_BODY_LLM_MAX_CHARS)}\n\n[truncated for OCR; original length=${String(decoded.length)}]`
      : decoded;
  const label =
    mimeType === "text/html"
      ? "Below is the HTML body of an inbound email (no suitable PDF attachment). Extract broker identification, holdings, and balances using only this content."
      : "Below is the plain text body of an inbound email (no suitable PDF attachment). Extract broker identification, holdings, and balances using only this content.";
  log(
    `OcrService: extractionPath=text mimeType=${mimeType} (email body) chars=${String(decoded.length)} truncated=${String(decoded.length > EMAIL_BODY_LLM_MAX_CHARS)}`,
  );
  return {
    baseUserContent: [
      { type: "text", text: label },
      { type: "text", text: truncated },
    ],
    meta: {
      path: "text",
      charCount: decoded.length,
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

  if (isSupportedEmailBodyMimeType(mimeType)) {
    return buildEmailBodyTextBase(buffer, mimeType);
  }

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
