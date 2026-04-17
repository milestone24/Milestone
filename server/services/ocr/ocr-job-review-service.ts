import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@server/db";
import {
  documents,
  ocrJobSecurityTransactions,
  ocrJobs,
  securityTransactions,
  userAssetSecurities,
  userAssets,
} from "@server/db/schema";
import type { DocumentOcrPipelineResult } from "@shared/schema/document";
import type { ExtractedAmount } from "@shared/schema/document";

export type PendingOcrReviewRow = {
  ocrJobId: string;
  processId: string | null;
  documentId: string | null;
  fileName: string | null;
  completedAt: Date | null;
  extractedValues: ExtractedAmount[] | null;
  pipeline: DocumentOcrPipelineResult | null;
};

export async function listPendingOcrReviewsForAsset(params: {
  userAccountId: string;
  assetId: string;
}): Promise<PendingOcrReviewRow[]> {
  const rows = await db
    .select({
      ocrJobId: ocrJobs.id,
      processId: ocrJobs.processId,
      documentId: ocrJobs.documentId,
      fileName: documents.fileName,
      completedAt: ocrJobs.completedAt,
      extractedValues: ocrJobs.extractedValues,
      pipeline: ocrJobs.pipeline,
    })
    .from(ocrJobs)
    .innerJoin(documents, eq(documents.id, ocrJobs.documentId))
    .where(
      and(
        eq(ocrJobs.status, "completed"),
        eq(ocrJobs.reviewState, "pending_review"),
        eq(documents.userAccountId, params.userAccountId),
        sql`(${ocrJobs.pipeline})->>'nominatedUserAssetId' = ${params.assetId}`
      )
    )
    .orderBy(desc(ocrJobs.completedAt));

  return rows.map((r) => ({
    ...r,
    extractedValues: r.extractedValues as ExtractedAmount[] | null,
    pipeline: r.pipeline as DocumentOcrPipelineResult | null,
  }));
}

export type RecordOcrReviewBody =
  | { outcome: "rejected" }
  | { outcome: "accepted"; securityTransactionIds: string[] };

/**
 * Marks review outcome. For `accepted`, inserts junction rows after verifying
 * every transaction belongs to the user's account.
 */
export async function recordOcrJobReviewOutcome(params: {
  userAccountId: string;
  ocrJobId: string;
  body: RecordOcrReviewBody;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await db.query.ocrJobs.findFirst({
    where: eq(ocrJobs.id, params.ocrJobId),
    columns: {
      id: true,
      documentId: true,
      reviewState: true,
      status: true,
    },
  });

  if (!job) {
    return { ok: false, error: "OCR job not found" };
  }
  if (job.status !== "completed" || job.reviewState !== "pending_review") {
    return { ok: false, error: "OCR job is not awaiting review" };
  }

  const doc = job.documentId
    ? await db.query.documents.findFirst({
        where: eq(documents.id, job.documentId),
        columns: { userAccountId: true },
      })
    : null;

  if (!doc || doc.userAccountId !== params.userAccountId) {
    return { ok: false, error: "Forbidden" };
  }

  if (params.body.outcome === "rejected") {
    await db
      .update(ocrJobs)
      .set({ reviewState: "rejected", updatedAt: new Date() })
      .where(eq(ocrJobs.id, params.ocrJobId));
    return { ok: true };
  }

  const ids = params.body.securityTransactionIds;
  if (ids.length === 0) {
    await db
      .update(ocrJobs)
      .set({ reviewState: "accepted", updatedAt: new Date() })
      .where(eq(ocrJobs.id, params.ocrJobId));
    return { ok: true };
  }

  const owned = await db
    .select({ id: securityTransactions.id })
    .from(securityTransactions)
    .innerJoin(
      userAssetSecurities,
      eq(userAssetSecurities.id, securityTransactions.assetSecurityId)
    )
    .innerJoin(userAssets, eq(userAssets.id, userAssetSecurities.userAssetId))
    .where(
      and(
        inArray(securityTransactions.id, ids),
        eq(userAssets.userAccountId, params.userAccountId)
      )
    );

  if (owned.length !== ids.length) {
    return { ok: false, error: "One or more transactions are invalid" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(ocrJobs)
      .set({ reviewState: "accepted", updatedAt: new Date() })
      .where(eq(ocrJobs.id, params.ocrJobId));

    await tx.insert(ocrJobSecurityTransactions).values(
      ids.map((securityTransactionId) => ({
        ocrJobId: params.ocrJobId,
        securityTransactionId,
      }))
    );
  });

  return { ok: true };
}
