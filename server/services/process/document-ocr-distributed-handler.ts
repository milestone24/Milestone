import { eq } from "drizzle-orm";
import { db } from "@server/db";
import { processes } from "@server/db/schema";
import {
  factory as queueFactory,
  isDocumentOcrMessage,
  Message,
} from "@server/services/distributed/queue";
import { updateProcessStatus } from "./job-helpers";
import { createJobScope } from "./job-scope";
import {
  registerShutdownHandler,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
} from "@server/utils/shutdown";
import { DocumentService } from "@server/services/documents";
import { OcrService, isSupportedMimeType } from "@server/services/ocr";

type Event = {
  jobId: string;
  documentId: string;
  platformKey: string;
  platformNames: string[];
  accountId: string;
  mimeType: string;
};

const documentService = new DocumentService();
const ocrService = new OcrService();

export const handler = async (event: Event): Promise<void> => {
  const { jobId, documentId, platformKey, platformNames, accountId, mimeType } =
    event;

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
      await updateProcessStatus(jobId, "failed", `Shutdown: ${signal}`);
      await queueService.publish({
        ...messageBase,
        type: "document-ocr-failed",
        message: `Shutdown: ${signal}`,
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

    if (!isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    const { buffer } = await documentService.getBuffer(documentId);

    const extractedValues = await ocrService.extract(
      buffer,
      mimeType,
      platformKey,
      platformNames
    );

    await updateProcessStatus(jobId, "completed");
    await queueService.publish({
      ...messageBase,
      type: "document-ocr-completed",
      extractedValues,
    });

    console.log(
      "[document-ocr] Completed jobId=%s extracted=%d values",
      jobId,
      extractedValues.length
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[document-ocr] Failed jobId=%s error=%s", jobId, message);
    await updateProcessStatus(jobId, "failed", message);
    await queueService.publish({
      ...messageBase,
      type: "document-ocr-failed",
      message,
    });
  }
};
