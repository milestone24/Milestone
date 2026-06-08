import { and, asc, eq } from "drizzle-orm";
import { db } from "@server/db";
import { brokerPlatformSecuritiesOcrContextInstructions } from "@server/db/schema";

/**
 * DB access for **OCR configuration** (platform-scoped instructions and similar).
 * Prompt shaping and pipeline behaviour stay in the OCR process (orchestrator / loaders).
 */

// --- Broker platform: securities phase (4a) context instructions ---

export type BrokerPlatformSecuritiesOcrContextInstructionRecord = {
  id: string;
  brokerPlatformId: string;
  instructionText: string;
  sortOrder: number;
  isActive: boolean;
};

export type InsertBrokerPlatformSecuritiesOcrContextInstructionParams = {
  brokerPlatformId: string;
  instructionText: string;
  sortOrder?: number;
  isActive?: boolean;
};

export async function insertBrokerPlatformSecuritiesOcrContextInstruction(
  params: InsertBrokerPlatformSecuritiesOcrContextInstructionParams
): Promise<{ id: string }> {
  const text = params.instructionText.trim();
  if (!text) {
    throw new Error("instructionText is required");
  }
  const sortOrder = params.sortOrder ?? 0;
  const isActive = params.isActive ?? true;

  const [row] = await db
    .insert(brokerPlatformSecuritiesOcrContextInstructions)
    .values({
      brokerPlatformId: params.brokerPlatformId,
      instructionText: text,
      sortOrder,
      isActive,
    })
    .returning({ id: brokerPlatformSecuritiesOcrContextInstructions.id });

  if (!row) {
    throw new Error("Failed to insert broker platform securities OCR context instruction");
  }
  return { id: row.id };
}

export type GetBrokerPlatformSecuritiesOcrContextInstructionsParams = {
  brokerPlatformId: string;
  /** When true (default), only `is_active` rows. */
  activeOnly?: boolean;
  /** Max rows (default 500). */
  limit?: number;
};

export async function getBrokerPlatformSecuritiesOcrContextInstructions(
  params: GetBrokerPlatformSecuritiesOcrContextInstructionsParams
): Promise<BrokerPlatformSecuritiesOcrContextInstructionRecord[]> {
  const activeOnly = params.activeOnly !== false;
  const limit = params.limit ?? 500;

  const conditions = [
    eq(brokerPlatformSecuritiesOcrContextInstructions.brokerPlatformId, params.brokerPlatformId),
  ];
  if (activeOnly) {
    conditions.push(eq(brokerPlatformSecuritiesOcrContextInstructions.isActive, true));
  }

  const rows = await db
    .select({
      id: brokerPlatformSecuritiesOcrContextInstructions.id,
      brokerPlatformId: brokerPlatformSecuritiesOcrContextInstructions.brokerPlatformId,
      instructionText: brokerPlatformSecuritiesOcrContextInstructions.instructionText,
      sortOrder: brokerPlatformSecuritiesOcrContextInstructions.sortOrder,
      isActive: brokerPlatformSecuritiesOcrContextInstructions.isActive,
    })
    .from(brokerPlatformSecuritiesOcrContextInstructions)
    .where(and(...conditions))
    .orderBy(
      asc(brokerPlatformSecuritiesOcrContextInstructions.sortOrder),
      asc(brokerPlatformSecuritiesOcrContextInstructions.id),
    )
    .limit(limit);

  return rows;
}
