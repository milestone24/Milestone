/**
 * Best-effort parse of errors thrown by `apiRequest` (`${status}: ${body}`).
 */
export function parseApiRequestError(message: string): string {
  const match = /^(\d+):\s*([\s\S]*)$/.exec(message.trim());
  if (!match) {
    return message;
  }
  const body = match[2]?.trim() ?? "";
  if (!body) {
    return message;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // fall through
  }
  return body;
}
