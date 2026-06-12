import { getBrokerPlatformSecuritiesOcrContextInstructions } from "./ocr-configuration-service";

const MAX_INSTRUCTIONS = 20;
const MAX_TOTAL_CHARS = 12_000;

/**
 * OCR pipeline: load and format broker-platform securities hints for phase 4a.
 * Uses {@link getBrokerPlatformSecuritiesOcrContextInstructions} then applies prompt limits.
 */

export async function loadBrokerPlatformSecuritiesOcrContextInstructions(
  brokerPlatformId: string
): Promise<string[]> {
  const rows = await getBrokerPlatformSecuritiesOcrContextInstructions({
    brokerPlatformId,
    activeOnly: true,
    limit: MAX_INSTRUCTIONS,
  });

  const trimmed = rows
    .map((r) => r.instructionText.trim())
    .filter((t) => t.length > 0);

  let total = 0;
  const out: string[] = [];
  for (const t of trimmed) {
    if (total + t.length > MAX_TOTAL_CHARS) {
      const remaining = MAX_TOTAL_CHARS - total;
      if (remaining > 100) {
        out.push(`${t.slice(0, remaining)}\n… [truncated]`);
      }
      break;
    }
    out.push(t);
    total += t.length;
  }
  return out;
}

export function formatSecuritiesOcrContextInstructionsForSystemPrompt(
  instructions: string[],
): string {
  if (instructions.length === 0) {
    return "";
  }
  const numbered = instructions.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return `

Issuer-specific guidance for locating and reading **security / fund holdings** (use only when consistent with the document; do not invent rows or values):
${numbered}
`;
}
