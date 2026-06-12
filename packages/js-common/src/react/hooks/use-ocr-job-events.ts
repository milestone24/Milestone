import { useEffect, useState } from "react";
import { useSocketUrl } from "../../platform/PlatformServicesProvider";
import type { ExtractedAmount } from "../../schema/document";
import type { DocumentOcrPipelineResult } from "../../schema/document";
import {
  registerInlineOcrProcessJob,
  unregisterInlineOcrProcessJob,
} from "../../utils/ocr-inline-job-awaiting";

export type OcrJobStatus =
  | { status: "idle" }
  | { status: "processing" }
  | {
      status: "complete";
      ocrJobId: string;
      extractedValues: ExtractedAmount[];
      pipeline: DocumentOcrPipelineResult;
    }
  | { status: "failed"; message: string }
  | { status: "aborted"; message: string };

/**
 * Subscribes to document-ocr-* WebSocket events for a specific process job.
 * Opens a connection only when jobId is non-null; closes on unmount or
 * when the job reaches a terminal state.
 */
export function useOcrJobEvents(jobId: string | null): OcrJobStatus {
  const socketUrl = useSocketUrl();
  const [jobStatus, setJobStatus] = useState<OcrJobStatus>({ status: "idle" });

  useEffect(() => {
    if (!jobId) {
      setJobStatus({ status: "idle" });
      return;
    }

    setJobStatus({ status: "processing" });
    registerInlineOcrProcessJob(jobId);

    const ws = new WebSocket(socketUrl.getWebSocketUrl());

    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (data.jobId !== jobId) return;

      if (data.type === "document-ocr-completed") {
        const ocrJobId =
          typeof data.ocrJobId === "string" ? data.ocrJobId : "";
        setJobStatus({
          status: "complete",
          ocrJobId,
          extractedValues: (data.extractedValues ?? []) as ExtractedAmount[],
          pipeline: data.pipeline as DocumentOcrPipelineResult,
        });
        ws.close();
      }

      if (data.type === "document-ocr-failed") {
        setJobStatus({
          status: "failed",
          message:
            typeof data.message === "string"
              ? data.message
              : "OCR processing failed",
        });
        ws.close();
      }

      if (data.type === "document-ocr-aborted") {
        setJobStatus({
          status: "aborted",
          message:
            typeof data.message === "string"
              ? data.message
              : "OCR processing was aborted",
        });
        ws.close();
      }
    };

    return () => {
      unregisterInlineOcrProcessJob(jobId);
      ws.close();
    };
  }, [jobId, socketUrl]);

  return jobStatus;
}
