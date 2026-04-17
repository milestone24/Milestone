import type { PdfTextExtractionConfig } from "./pdf-text-config";

/** Count tokens that look like words (for sparse scanned PDFs with junk). */
export function countAlphabeticWords(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length;
}

export function isNativePdfTextSufficient(
  text: string,
  config: PdfTextExtractionConfig
): { charCount: number; wordCount: number; sufficient: boolean } {
  const trimmed = text.trim();
  const nonWhitespaceChars = trimmed.replace(/\s/g, "").length;
  const wordCount = countAlphabeticWords(trimmed);
  const sufficient =
    nonWhitespaceChars >= config.minNonWhitespaceChars &&
    wordCount >= config.minAlphabeticWords;
  return {
    charCount: nonWhitespaceChars,
    wordCount,
    sufficient,
  };
}
