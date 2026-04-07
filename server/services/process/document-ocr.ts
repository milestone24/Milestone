import { db } from "@server/db";
import { processes } from "@server/db/schema";
import { getUserAccountId } from "@server/auth";
import { DocumentService } from "@server/services/documents";
import {
  DEFAULT_PENDING_TTL_MS,
  DEFAULT_RUNNING_TTL_MS,
  startPeriodicReconciliationForResource,
} from "./process-reconcile";
import { handler } from "./document-ocr-distributed-handler";

const documentService = new DocumentService();

export async function startDocumentOcr(
  file: Express.Multer.File,
  platformKey: string,
  platformNames: string[]
): Promise<{ jobId: string; documentId: string }> {
  const accountId = getUserAccountId();

  const document = await documentService.upload(file);

  const [job] = await db
    .insert(processes)
    .values({
      key: "document-ocr",
      status: "pending",
      startedAt: new Date(),
      payload: {
        documentId: document.id,
        platformKey,
        accountId,
      },
    })
    .returning();

  if (!job) {
    throw new Error("Failed to create document OCR process");
  }

  handler({
    jobId: job.id,
    documentId: document.id,
    platformKey,
    platformNames,
    accountId,
    mimeType: document.mimeType,
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
