/**
 * Best-effort writes for `ocr_jobs` rows (same spirit as {@link updateProcessStatus}):
 * errors are logged and not rethrown so distributed handlers stay resilient.
 *
 * Rows are inserted with `processes` in `startDocumentOcr` so every started job
 * has an `ocr_jobs` record.
 */
import { db } from "@server/db";
import { ocrJobs } from "@server/db/schema";
import { eq } from "drizzle-orm";
import type { ExtractedAmount } from "@shared/schema/document";
import type { DocumentOcrPipelineResult } from "@shared/schema/document";

type CompleteParams = {
  ocrJobId: string;
  extractedValues: ExtractedAmount[];
  pipeline: DocumentOcrPipelineResult;
};

type FailParams = {
  ocrJobId: string;
  error: string;
  /** When set (e.g. securities phase failed after brand verification), stored with the failure row. */
  pipeline?: DocumentOcrPipelineResult;
  extractedValues?: ExtractedAmount[];
};

type AbortParams = {
  ocrJobId: string;
  error: string;
};

/** @returns whether the DB update succeeded */
export async function tryMarkOcrJobRunning(ocrJobId: string): Promise<boolean> {
  try {
    await db
      .update(ocrJobs)
      .set({ status: "running" })
      .where(eq(ocrJobs.id, ocrJobId));
    return true;
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to mark ocr_jobs running ocrJobId=%s",
      ocrJobId,
      error
    );
    return false;
  }
}

/** @returns whether the DB update succeeded */
export async function tryCompleteOcrJobRecord(
  params: CompleteParams
): Promise<boolean> {
  try {
    await db
      .update(ocrJobs)
      .set({
        status: "completed",
        extractedValues: params.extractedValues,
        pipeline: params.pipeline,
        completedAt: new Date(),
        reviewState: "pending_review",
      })
      .where(eq(ocrJobs.id, params.ocrJobId));
    return true;
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to complete ocr_jobs row ocrJobId=%s",
      params.ocrJobId,
      error
    );
    return false;
  }
}

/** @returns whether the DB update succeeded */
export async function tryFailOcrJobRecord(params: FailParams): Promise<boolean> {
  try {
    await db
      .update(ocrJobs)
      .set({
        status: "failed",
        error: params.error,
        completedAt: new Date(),
        reviewState: null,
        ...(params.pipeline !== undefined ? { pipeline: params.pipeline } : {}),
        ...(params.extractedValues !== undefined
          ? { extractedValues: params.extractedValues }
          : {}),
      })
      .where(eq(ocrJobs.id, params.ocrJobId));
    return true;
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to fail ocr_jobs row ocrJobId=%s",
      params.ocrJobId,
      error
    );
    return false;
  }
}

/** @returns whether the DB update succeeded */
export async function tryAbortOcrJobRecord(params: AbortParams): Promise<boolean> {
  try {
    await db
      .update(ocrJobs)
      .set({
        status: "aborted",
        error: params.error,
        completedAt: new Date(),
        reviewState: null,
      })
      .where(eq(ocrJobs.id, params.ocrJobId));
    return true;
  } catch (error) {
    console.error(
      "[ocr-job-store] Failed to abort ocr_jobs row ocrJobId=%s",
      params.ocrJobId,
      error
    );
    return false;
  }
}
