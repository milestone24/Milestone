/**
 * Thin write layer for ocr_jobs rows.
 *
 * Mirrors the error-handling philosophy of job-helpers.ts: all errors are
 * caught and logged rather than rethrown so that a DB hiccup does not abort
 * the handler or leave the process in an inconsistent terminal state.
 *
 * One ocr_jobs row is created per handler invocation (not per process row).
 * document_id and process_id are SET NULL on delete so the OCR record
 * outlives both the document being removed and the processes row being purged.
 */
import { db } from "@server/db";
import { ocrJobs, type OcrJobSelect } from "@server/db/schema";
import { eq } from "drizzle-orm";
import type { ExtractedAmount } from "@shared/schema/document";
import type { DocumentOcrPipelineResult } from "@shared/schema/document";

type CreateParams = {
  documentId: string;
  processId: string;
  platformKey: string;
};

type CompleteParams = {
  ocrJobId: string;
  extractedValues: ExtractedAmount[];
  pipeline: DocumentOcrPipelineResult;
};

type FailParams = {
  ocrJobId: string;
  error: string;
};

export async function createOcrJobRecord(
  params: CreateParams
): Promise<string | undefined> {
  try {
    const [row] = await db
      .insert(ocrJobs)
      .values({
        documentId: params.documentId,
        processId: params.processId,
        platformKey: params.platformKey,
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: ocrJobs.id });
    return row?.id;
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to create ocr_jobs row documentId=%s processId=%s",
      params.documentId,
      params.processId,
      error
    );
    return undefined;
  }
}

export async function completeOcrJobRecord(
  params: CompleteParams
): Promise<void> {
  try {
    await db
      .update(ocrJobs)
      .set({
        status: "completed",
        extractedValues: params.extractedValues,
        pipeline: params.pipeline,
        completedAt: new Date(),
      })
      .where(eq(ocrJobs.id, params.ocrJobId));
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to complete ocr_jobs row ocrJobId=%s",
      params.ocrJobId,
      error
    );
  }
}

export async function failOcrJobRecord(params: FailParams): Promise<void> {
  try {
    await db
      .update(ocrJobs)
      .set({
        status: "failed",
        error: params.error,
        completedAt: new Date(),
      })
      .where(eq(ocrJobs.id, params.ocrJobId));
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to fail ocr_jobs row ocrJobId=%s",
      params.ocrJobId,
      error
    );
  }
}
