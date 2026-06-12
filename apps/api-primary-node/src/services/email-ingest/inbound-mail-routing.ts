/**
 * Extracts ingest `short_code` from a recipient address using the same env
 * contract as {@link buildIngestAddress} in `email-ingest-inbox-service.ts`.
 */

export function extractShortCodeFromRecipientAddress(
  recipient: string,
): string | null {
  const fqdn = process.env.EMAIL_INBOUND_MAIL_FQDN?.trim().toLowerCase();
  if (!fqdn) {
    return null;
  }
  const rawPrefix =
    process.env.EMAIL_INGEST_LOCAL_PART_PREFIX?.trim() || "ingest";
  const prefix = rawPrefix.toLowerCase();
  const lower = recipient.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at <= 0) {
    return null;
  }
  const host = lower.slice(at + 1);
  if (host !== fqdn) {
    return null;
  }
  const localPart = lower.slice(0, at);
  const expected = `${prefix}+`;
  if (!localPart.startsWith(expected)) {
    return null;
  }
  const code = localPart.slice(expected.length);
  if (!/^[0-9a-f]+$/.test(code)) {
    return null;
  }
  return code;
}

export function pickShortCodeFromRecipients(
  recipients: string[],
): string | null {
  for (const r of recipients) {
    const code = extractShortCodeFromRecipientAddress(r);
    if (code) {
      return code;
    }
  }
  return null;
}
