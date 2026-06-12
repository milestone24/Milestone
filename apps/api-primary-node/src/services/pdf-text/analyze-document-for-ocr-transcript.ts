import { extractPdfNativeText } from "@/services/pdf-text/extract-pdf-native-text";
import { isNativePdfTextSufficient } from "@/services/pdf-text/is-text-sufficient";
import type { PdfTextExtractionConfig } from "@/services/pdf-text/pdf-text-config";

export type DocumentTranscriptAnalysis =
  | { kind: "not_pdf"; mimeType: string }
  | {
      kind: "pdf_transcript";
      totalPages: number;
      charCount: number;
      wordCount: number;
      /** Full merged transcript for the LLM when `useTranscriptPath` is true. */
      fullTranscript: string;
      useTranscriptPath: boolean;
    };

/**
 * Non-PDF inputs skip native PDF text extraction. PDFs always run extraction;
 * password-protected PDFs throw from {@link extractPdfNativeText}.
 */
export async function analyzeDocumentForOcrTranscript(
  buffer: Buffer,
  mimeType: string,
  config: PdfTextExtractionConfig,
  options?: { abortSignal?: AbortSignal }
): Promise<DocumentTranscriptAnalysis> {
  if (mimeType !== "application/pdf") {
    return { kind: "not_pdf", mimeType };
  }

  const { fullTranscript, totalPages } = await extractPdfNativeText(buffer, {
    abortSignal: options?.abortSignal,
  });
  options?.abortSignal?.throwIfAborted();
  const { charCount, wordCount, sufficient } = isNativePdfTextSufficient(
    fullTranscript,
    config
  );

  return {
    kind: "pdf_transcript",
    totalPages,
    charCount,
    wordCount,
    fullTranscript,
    useTranscriptPath: sufficient,
  };
}
