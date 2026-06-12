/** PDF requires a password; we do not accept password-protected statements in OCR. */
export class PdfPasswordProtectedError extends Error {
  readonly code = "PDF_PASSWORD_PROTECTED" as const;

  constructor(
    message = "PDF is password-protected or encrypted. Remove the password or use an unencrypted export."
  ) {
    super(message);
    this.name = "PdfPasswordProtectedError";
  }
}
