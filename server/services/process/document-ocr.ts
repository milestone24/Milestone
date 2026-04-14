import { and, eq } from "drizzle-orm";
import { db } from "@server/db";
import { ocrJobs, processes, userAssets } from "@server/db/schema";
import { getUserAccountId } from "@server/auth";
import { DocumentService } from "@server/services/documents";
import {
  DEFAULT_PENDING_TTL_MS,
  DEFAULT_RUNNING_TTL_MS,
  startPeriodicReconciliationForResource,
} from "./process-reconcile";
import { handler } from "./document-ocr-distributed-handler";

const documentService = new DocumentService();

/** Thrown when `nominatedUserAssetId` is set but the row is missing or not owned by the account. */
export class NominatedUserAssetInvalidError extends Error {
  override readonly name = "NominatedUserAssetInvalidError";

  constructor() {
    super("Nominated user asset not found or does not belong to this account");
  }
}

export type StartDocumentOcrOptions = {
  nominatedUserAssetId?: string;
};

export async function startDocumentOcr(
  file: Express.Multer.File,
  platformKey: string,
  platformNames: string[],
  options?: StartDocumentOcrOptions
): Promise<{ jobId: string; documentId: string }> {
  const accountId = getUserAccountId();
  const nominatedUserAssetId = options?.nominatedUserAssetId;

  if (nominatedUserAssetId) {
    const row = await db.query.userAssets.findFirst({
      where: and(
        eq(userAssets.id, nominatedUserAssetId),
        eq(userAssets.userAccountId, accountId)
      ),
      columns: { id: true },
    });
    if (!row) {
      throw new NominatedUserAssetInvalidError();
    }
  }

  const document = await documentService.upload(file);

  const { job, ocrJobId } = await db.transaction(async (tx) => {
    const [jobRow] = await tx
      .insert(processes)
      .values({
        key: "document-ocr",
        status: "pending",
        startedAt: new Date(),
        payload: {
          documentId: document.id,
          platformKey,
          accountId,
          ...(nominatedUserAssetId ? { nominatedUserAssetId } : {}),
        },
      })
      .returning();

    if (!jobRow) {
      throw new Error("Failed to create document OCR process");
    }

    const [ocrRow] = await tx
      .insert(ocrJobs)
      .values({
        documentId: document.id,
        processId: jobRow.id,
        platformKey,
        status: "pending",
        startedAt: new Date(),
      })
      .returning({ id: ocrJobs.id });

    if (!ocrRow) {
      throw new Error("Failed to create ocr_jobs row");
    }

    return { job: jobRow, ocrJobId: ocrRow.id };
  });

  handler({
    jobId: job.id,
    ocrJobId,
    documentId: document.id,
    platformKey,
    platformNames,
    accountId,
    mimeType: document.mimeType,
    nominatedUserAssetId,
  }).catch((err) => {
    console.error("[document-ocr] handler error jobId=%s", job.id, err);
  });

  startPeriodicReconciliationForResource({
    jobId: job.id,
    pendingTtlMs: DEFAULT_PENDING_TTL_MS,
    runningTtlMs: DEFAULT_RUNNING_TTL_MS,
  });

  return { jobId: job.id, documentId: document.id };
}
