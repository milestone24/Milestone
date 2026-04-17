import { eq } from "drizzle-orm";
import { db } from "@server/db";
import { processes } from "@server/db/schema";
import {
  factory as queueFactory,
  isDocumentOcrMessage,
  Message,
} from "@server/services/distributed/queue";
import {
  createAbortCompletionPromise,
  racePromiseWithAbortSignal,
  updateProcessStatus,
} from "./job-helpers";
import {
  tryAbortOcrJobRecord,
  tryCompleteOcrJobRecord,
  tryFailOcrJobRecord,
  tryMarkOcrJobRunning,
} from "./ocr-job-store";
import { createJobScope } from "./job-scope";
import {
  registerShutdownHandler,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
} from "@server/utils/shutdown";
import { DocumentService } from "@server/services/documents";
import {
  OcrService,
  isSupportedMimeType,
  runFullDocumentOcrPipeline,
} from "@server/services/ocr";

type Event = {
  jobId: string;
  ocrJobId: string;
  documentId: string;
  platformKey: string;
  platformNames: string[];
  accountId: string;
  mimeType: string;
  nominatedUserAssetId?: string;
};

const documentService = new DocumentService();
const ocrService = new OcrService();

/**
 * Document OCR distributed handler.
 *
 * Shutdown and external cancel follow the same pattern as {@link handler} in
 * `asset-values-distributed-handler.ts` and `securities-cache-distributed-handler.ts`:
 * `AbortController` + `createAbortCompletionPromise` so SIGINT/SIGTERM waits until
 * `processes.status` is `aborted` in the DB before the shutdown coordinator proceeds.
 */
export const handler = async (event: Event): Promise<void> => {
  const {
    jobId,
    ocrJobId,
    documentId,
    platformKey,
    platformNames,
    accountId,
    mimeType,
    nominatedUserAssetId,
  } = event;

  console.log(
    "[document-ocr] Handler started jobId=%s documentId=%s platformKey=%s",
    jobId,
    documentId,
    platformKey
  );

  const job = await db.query.processes.findFirst({
    where: eq(processes.id, jobId),
  });

  if (!job) {
    throw new Error(`[document-ocr] Job not found jobId=${jobId}`);
  }

  const abortController = new AbortController();
  const { promise: abortCompletePromise, resolve: resolveAbort } =
    createAbortCompletionPromise(jobId);

  let abortSequenceDone = false;

  const queueService = queueFactory();

  const messageBase = { jobId, ocrJobId, accountId, documentId };

  const finalizeAbortSequence = async (reason: string): Promise<void> => {
    if (abortSequenceDone) {
      return;
    }
    abortSequenceDone = true;
    const text = reason.trim().length > 0 ? reason.trim() : "Aborted";
    await updateProcessStatus(jobId, "aborted");
    const ocrOk = await tryAbortOcrJobRecord({ ocrJobId, error: text });
    if (!ocrOk) {
      console.error(
        "[document-ocr] Failed to persist ocr_jobs aborted jobId=%s ocrJobId=%s",
        jobId,
        ocrJobId
      );
    }
    await queueService.publish({
      ...messageBase,
      type: "document-ocr-aborted",
      message: text,
    });
    resolveAbort();
  };

  const unregisterShutdown = registerShutdownHandler(
    async (signal) => {
      console.log(
        "[document-ocr] Shutdown signal=%s jobId=%s — signalling abort",
        signal,
        jobId
      );
      abortController.abort(`shutdown signal: ${signal}`);
      await abortCompletePromise;
      console.log(
        "[document-ocr] Job confirmed aborted in DB jobId=%s",
        jobId
      );
    },
    { timeout: DEFAULT_SHUTDOWN_TIMEOUT_MS }
  );

  const callback = async (message: Message) => {
    if (!isDocumentOcrMessage(message)) return;
    if (message.type === "document-ocr-abort" && message.jobId === jobId) {
      console.log("[document-ocr] External abort received jobId=%s", jobId);
      abortController.abort("document-ocr-abort");
    }
  };
  queueService.subscribe(callback);

  await using _jobScope = createJobScope({
    unregisterShutdown,
    unsubscribe: () => queueService.unsubscribe(callback),
  });

  try {
    await updateProcessStatus(jobId, "running");
    const runningMarked = await tryMarkOcrJobRunning(ocrJobId);
    if (!runningMarked) {
      console.error(
        "[document-ocr] Failed to mark ocr_jobs running jobId=%s ocrJobId=%s",
        jobId,
        ocrJobId
      );
    }
    await queueService.publish({ ...messageBase, type: "document-ocr-started" });

    if (!isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    const { buffer } = await documentService.getBuffer(documentId);

    const pipelinePromise = runFullDocumentOcrPipeline({
      buffer,
      mimeType,
      platformKey,
      platformNames,
      accountId,
      nominatedUserAssetId,
      abortSignal: abortController.signal,
      extractBalances: (prepared, opts) =>
        ocrService.extractFromPrepared(prepared, platformKey, platformNames, {
          abortSignal: opts?.abortSignal,
        }),
    });

    const { pipeline, extractedValues, securitiesExtractionError } =
      await racePromiseWithAbortSignal(pipelinePromise, abortController.signal);

    if (securitiesExtractionError) {
      await updateProcessStatus(jobId, "failed", securitiesExtractionError);
      const failOk = await tryFailOcrJobRecord({
        ocrJobId,
        error: securitiesExtractionError,
        pipeline,
        extractedValues,
      });
      if (!failOk) {
        console.error(
          "[document-ocr] Failed to persist partial ocr_jobs failure jobId=%s ocrJobId=%s",
          jobId,
          ocrJobId
        );
      }
      await queueService.publish({
        ...messageBase,
        type: "document-ocr-failed",
        message: securitiesExtractionError,
        pipeline,
        extractedValues,
      });
      console.log(
        "[document-ocr] Securities phase failed (partial pipeline persisted) jobId=%s ocrJobId=%s error=%s",
        jobId,
        ocrJobId,
        securitiesExtractionError
      );
      return;
    }

    const completedOk = await tryCompleteOcrJobRecord({
      ocrJobId,
      extractedValues,
      pipeline,
    });
    if (!completedOk) {
      const persistMsg = "Failed to persist OCR job results";
      await updateProcessStatus(jobId, "failed", persistMsg);
      await tryFailOcrJobRecord({ ocrJobId, error: persistMsg });
      await queueService.publish({
        ...messageBase,
        type: "document-ocr-failed",
        message: persistMsg,
      });
      return;
    }

    await updateProcessStatus(jobId, "completed");
    await queueService.publish({
      ...messageBase,
      type: "document-ocr-completed",
      extractedValues,
      pipeline,
    });

    console.log(
      "[document-ocr] Completed jobId=%s path=%s charCount=%s extracted=%d securityRows=%d",
      jobId,
      pipeline.llmPath,
      pipeline.nativePdfCharCount ?? "n/a",
      extractedValues.length,
      pipeline.securityHoldings.length
    );
  } catch (err) {
    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      await finalizeAbortSequence(err.message);
      return;
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[document-ocr] Failed jobId=%s error=%s", jobId, message);
    await updateProcessStatus(jobId, "failed", message);
    const ocrFailOk = await tryFailOcrJobRecord({ ocrJobId, error: message });
    if (!ocrFailOk) {
      console.error(
        "[document-ocr] Failed to persist ocr_jobs failure jobId=%s ocrJobId=%s",
        jobId,
        ocrJobId
      );
    }
    await queueService.publish({
      ...messageBase,
      type: "document-ocr-failed",
      message,
    });
  }
};
