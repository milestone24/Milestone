import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, ocrJobs, processes } from "@/db/schema";
import type { ExtractedAmount, OcrJobDetail, OcrJobListItem } from "@shared/schema/document";
import {
  documentOcrPipelineResultSchema,
  extractedAmountSchema,
  ocrJobDetailSchema,
} from "@shared/schema/document";
import { z } from "zod";

function mapProcessRow(p: {
  id: string;
  key: string;
  status: "pending" | "running" | "completed" | "failed" | "aborted";
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}): OcrJobListItem["process"] {
  return {
    id: p.id,
    key: p.key,
    status: p.status,
    startedAt: p.startedAt,
    completedAt: p.completedAt,
    error: p.error,
  };
}

export async function listOcrJobsForAccount(
  userAccountId: string
): Promise<OcrJobListItem[]> {
  const rows = await db
    .select({
      id: ocrJobs.id,
      documentId: ocrJobs.documentId,
      documentFileName: documents.fileName,
      processId: ocrJobs.processId,
      platformKey: ocrJobs.platformKey,
      status: ocrJobs.status,
      startedAt: ocrJobs.startedAt,
      completedAt: ocrJobs.completedAt,
      error: ocrJobs.error,
      reviewState: ocrJobs.reviewState,
      processIdJoin: processes.id,
      processKey: processes.key,
      processStatus: processes.status,
      processStartedAt: processes.startedAt,
      processCompletedAt: processes.completedAt,
      processError: processes.error,
    })
    .from(ocrJobs)
    .innerJoin(documents, eq(documents.id, ocrJobs.documentId))
    .leftJoin(processes, eq(processes.id, ocrJobs.processId))
    .where(eq(documents.userAccountId, userAccountId))
    .orderBy(desc(ocrJobs.startedAt));

  return rows.map((r) => {
    const process =
      r.processIdJoin && r.processKey && r.processStatus != null && r.processStartedAt
        ? mapProcessRow({
            id: r.processIdJoin,
            key: r.processKey,
            status: r.processStatus,
            startedAt: r.processStartedAt,
            completedAt: r.processCompletedAt,
            error: r.processError,
          })
        : null;

    return {
      id: r.id,
      documentId: r.documentId,
      documentFileName: r.documentFileName,
      processId: r.processId,
      platformKey: r.platformKey,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      error: r.error,
      reviewState: r.reviewState,
      process,
    };
  });
}

export async function getOcrJobDetailForAccount(params: {
  userAccountId: string;
  ocrJobId: string;
}): Promise<OcrJobDetail | null> {
  const rows = await db
    .select({
      id: ocrJobs.id,
      documentId: ocrJobs.documentId,
      documentFileName: documents.fileName,
      processId: ocrJobs.processId,
      platformKey: ocrJobs.platformKey,
      status: ocrJobs.status,
      startedAt: ocrJobs.startedAt,
      completedAt: ocrJobs.completedAt,
      error: ocrJobs.error,
      reviewState: ocrJobs.reviewState,
      extractedValues: ocrJobs.extractedValues,
      pipeline: ocrJobs.pipeline,
      processIdJoin: processes.id,
      processKey: processes.key,
      processStatus: processes.status,
      processStartedAt: processes.startedAt,
      processCompletedAt: processes.completedAt,
      processError: processes.error,
    })
    .from(ocrJobs)
    .innerJoin(documents, eq(documents.id, ocrJobs.documentId))
    .leftJoin(processes, eq(processes.id, ocrJobs.processId))
    .where(
      and(eq(ocrJobs.id, params.ocrJobId), eq(documents.userAccountId, params.userAccountId))
    )
    .limit(1);

  const r = rows[0];
  if (!r) {
    return null;
  }

  let pipeline: OcrJobDetail["pipeline"] = null;
  if (r.pipeline != null) {
    const parsed = documentOcrPipelineResultSchema.safeParse(r.pipeline);
    pipeline = parsed.success ? parsed.data : null;
  }

  let extractedValues: ExtractedAmount[] | null = null;
  if (Array.isArray(r.extractedValues)) {
    const ev = z.array(extractedAmountSchema).safeParse(r.extractedValues);
    extractedValues = ev.success ? ev.data : null;
  }

  const process =
    r.processIdJoin && r.processKey && r.processStatus != null && r.processStartedAt
      ? mapProcessRow({
          id: r.processIdJoin,
          key: r.processKey,
          status: r.processStatus,
          startedAt: r.processStartedAt,
          completedAt: r.processCompletedAt,
          error: r.processError,
        })
      : null;

  const detail: OcrJobDetail = {
    id: r.id,
    documentId: r.documentId,
    documentFileName: r.documentFileName,
    processId: r.processId,
    platformKey: r.platformKey,
    status: r.status,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    error: r.error,
    reviewState: r.reviewState,
    process,
    extractedValues,
    pipeline,
  };

  return ocrJobDetailSchema.parse(detail);
}
