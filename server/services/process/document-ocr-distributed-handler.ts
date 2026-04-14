import { eq } from "drizzle-orm";
import { db } from "@server/db";
import { processes } from "@server/db/schema";
import {
  factory as queueFactory,
  isDocumentOcrMessage,
  Message,
} from "@server/services/distributed/queue";
import { updateProcessStatus } from "./job-helpers";
import {
  createOcrJobRecord,
  completeOcrJobRecord,
  failOcrJobRecord,
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
  documentId: string;
  platformKey: string;
  platformNames: string[];
  accountId: string;
  mimeType: string;
  nominatedUserAssetId?: string;
};

const documentService = new DocumentService();
const ocrService = new OcrService();

export const handler = async (event: Event): Promise<void> => {
  const {
    jobId,
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

  const queueService = queueFactory();

  const messageBase = { jobId, accountId, documentId };

  // Holds the ocr_jobs row id once created; used by the shutdown handler and
  // catch block to mark the record failed if the pipeline does not complete.
  let ocrJobId: string | undefined;

  const callback = async (message: Message) => {
    if (!isDocumentOcrMessage(message)) return;
    if (message.type === "document-ocr-failed" && message.jobId === jobId) {
      console.log("[document-ocr] External abort received jobId=%s", jobId);
    }
  };
  queueService.subscribe(callback);

  const unregisterShutdown = registerShutdownHandler(
    async (signal) => {
      console.log(
        "[document-ocr] Shutdown signal=%s jobId=%s — marking failed",
        signal,
        jobId
      );
      const shutdownError = `Shutdown: ${signal}`;
      await updateProcessStatus(jobId, "failed", shutdownError);
      if (ocrJobId) {
        await failOcrJobRecord({ ocrJobId, error: shutdownError });
      }
      await queueService.publish({
        ...messageBase,
        type: "document-ocr-failed",
        message: shutdownError,
      });
    },
    { timeout: DEFAULT_SHUTDOWN_TIMEOUT_MS }
  );

  await using _jobScope = createJobScope({
    unregisterShutdown,
    unsubscribe: () => queueService.unsubscribe(callback),
  });

  try {
    await updateProcessStatus(jobId, "running");
    await queueService.publish({ ...messageBase, type: "document-ocr-started" });

    ocrJobId = await createOcrJobRecord({ documentId, processId: jobId, platformKey });

    if (!isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    const { buffer } = await documentService.getBuffer(documentId);

    const { pipeline, extractedValues } = await runFullDocumentOcrPipeline({
      buffer,
      mimeType,
      platformKey,
      platformNames,
      accountId,
      nominatedUserAssetId,
      extractBalances: (prepared) =>
        ocrService.extractFromPrepared(prepared, platformKey, platformNames),
    });

    await updateProcessStatus(jobId, "completed");
    if (ocrJobId) {
      await completeOcrJobRecord({ ocrJobId, extractedValues, pipeline });
    }
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
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[document-ocr] Failed jobId=%s error=%s", jobId, message);
    await updateProcessStatus(jobId, "failed", message);
    if (ocrJobId) {
      await failOcrJobRecord({ ocrJobId, error: message });
    }
    await queueService.publish({
      ...messageBase,
      type: "document-ocr-failed",
      message,
    });
  }
};
