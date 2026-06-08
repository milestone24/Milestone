function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/**
 * Tunable thresholds for “native PDF text is good enough” vs vision/document path.
 * Override via env without code changes.
 */
export type PdfTextExtractionConfig = {
  /** Minimum non-whitespace characters after trim (default 200). */
  minNonWhitespaceChars: number;
  /** Minimum “word-like” tokens (Unicode letters, length ≥ 2) (default 25). */
  minAlphabeticWords: number;
};

export function loadPdfTextExtractionConfigFromEnv(): PdfTextExtractionConfig {
  return {
    minNonWhitespaceChars: parsePositiveInt(
      process.env.OCR_PDF_TEXT_MIN_CHARS,
      200
    ),
    minAlphabeticWords: parsePositiveInt(
      process.env.OCR_PDF_TEXT_MIN_WORDS,
      25
    ),
  };
}
