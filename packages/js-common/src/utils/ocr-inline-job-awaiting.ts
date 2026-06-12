/**
 * Process `jobId` values for which the record page (or similar) is waiting on
 * `useOcrJobEvents` so the global socket handler should not duplicate the
 * completion toast.
 */
const inlineProcessJobIds = new Set<string>();

export function registerInlineOcrProcessJob(jobId: string): void {
  inlineProcessJobIds.add(jobId);
}

export function unregisterInlineOcrProcessJob(jobId: string): void {
  inlineProcessJobIds.delete(jobId);
}

export function isInlineOcrProcessJob(jobId: string): boolean {
  return inlineProcessJobIds.has(jobId);
}
