import { and, asc, eq } from "drizzle-orm";
import { db } from "@server/db";
import { brokerPlatformSecuritiesOcrContextInstructions } from "@server/db/schema";

const MAX_INSTRUCTIONS = 20;
const MAX_TOTAL_CHARS = 12_000;

/**
 * Active DB hints for phase 4a, ordered by `sort_order` then `id`.
 * Bound to resolved `broker_platforms.id` (post brand verification).
 */
export async function loadBrokerPlatformSecuritiesOcrContextInstructions(
  brokerPlatformId: string
): Promise<string[]> {
  const rows = await db
    .select({ text: brokerPlatformSecuritiesOcrContextInstructions.instructionText })
    .from(brokerPlatformSecuritiesOcrContextInstructions)
    .where(
      and(
        eq(brokerPlatformSecuritiesOcrContextInstructions.brokerPlatformId, brokerPlatformId),
        eq(brokerPlatformSecuritiesOcrContextInstructions.isActive, true),
      ),
    )
    .orderBy(
      asc(brokerPlatformSecuritiesOcrContextInstructions.sortOrder),
      asc(brokerPlatformSecuritiesOcrContextInstructions.id),
    )
    .limit(MAX_INSTRUCTIONS);

  const trimmed = rows
    .map((r) => r.text.trim())
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
